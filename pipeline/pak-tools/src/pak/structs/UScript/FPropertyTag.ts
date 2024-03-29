import {Reader} from "../../../readers/Reader";
import {UAsset} from "../../pakfile/UAsset";
import {Shape} from "../../../util/parsers";
import {ByteBoolean, Int16, Int32, Int64, Int8, UInt16, UInt32, UInt64} from "../../primitive/integers";
import {FSoftObjectPath} from "./properties/FSoftObjectPath";
import {DelegateProperty} from "./properties/DelegateProperty";
import {bigintToNumber} from "../../../util/numeric";
import {MapProperty, MapPropertyTagMetaData} from "./properties/MapProperty";
import {EnumProperty, EnumPropertyTagMetaData} from "./properties/EnumProperty";
import {FName, NameMap} from "./FName";
import {UScriptArray, UScriptArrayMetaData} from "./UScriptStrutTypes/UScriptArray";
import {FText} from "./UScriptStrutTypes/FText";
import {FGuid} from "./UScriptStrutTypes/FGuid";
import {StructPropertyTagMetaData, UScriptStruct} from "./UscriptStruct";
import {FPackageIndex} from "../file/FPackageIndex";
import {FString} from "../../containers/FString";
import {Double, Float} from "../../primitive/decimals";
import {InterfaceProperty} from "./properties/InterfaceProperty";
import {ByteProperty, BytePropertyTagMetaData} from "./properties/ByteProperty";
import {SetProperty, SetPropertyTagMetaData} from "./properties/SetProperty";
import {FieldPathProperty} from "./properties/FieldPathProperty";
import {MulticastDelegateProperty} from "./properties/MulticastSparseDelegateProperty";

export type TagMetaData =
  | Shape<typeof StructPropertyTagMetaData>
  | Shape<typeof BytePropertyTagMetaData>
  | Shape<typeof EnumPropertyTagMetaData>
  | Shape<typeof UScriptArrayMetaData>
  | Shape<typeof SetPropertyTagMetaData>
  | Shape<typeof MapPropertyTagMetaData>
  | Shape<typeof ByteBoolean>;

// https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L80-L169
export function FPropertyTag(asset: UAsset, shouldRead: boolean, depth: number) {
  return async function (reader: Reader) {
    const names: NameMap = asset.names;

    const name = await reader.read(FName(names));

    // https://docs.unrealengine.com/en-US/API/Runtime/Core/UObject/EName/index.html
    // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L90
    if (name === 'None') {
      return null;
    }

    const baseTag = {
      name,
      propertyType: await reader.read(FName(names)),
      size: await reader.read(Int32),
      arrayIndex: await reader.read(Int32),
    };

    let tagMetaData: TagMetaData | null = null;
    switch (baseTag.propertyType) {
      // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L112-L119
      case 'StructProperty':
        tagMetaData = await reader.read(StructPropertyTagMetaData(names));
        break;
      // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L121-L132
      case 'BoolProperty':
        // This should actually be switched with the tag itself.
        tagMetaData = await reader.read(ByteBoolean);
        break;
      // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L134-L137
      case 'ByteProperty':
        tagMetaData = await reader.read(BytePropertyTagMetaData(names));
        break;
      // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L134-L137
      case 'EnumProperty':
        tagMetaData = await reader.read(EnumPropertyTagMetaData(names));
        break;
      // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L139-L145
      case 'ArrayProperty':
        tagMetaData = await reader.read(UScriptArrayMetaData(names));
        break;
      // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L148-L151
      case 'SetProperty':
        tagMetaData = await reader.read(SetPropertyTagMetaData(names));
        break;
      // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyTag.cpp#L152-L156
      case 'MapProperty':
        tagMetaData = await reader.read(MapPropertyTagMetaData(names));
        break;
      default:
        break;
    }

    // ???
    //
    // if (property_type == "MapProperty")
    // {
    //   tag_data = tag_data_overrides(name) ?? tag_data;
    // }
    //
    // ???
    // https://github.com/iAmAsval/FModel/blob/05e7b0a6dae81c3a7769ed68add0dbfd49b02745/FModel/Methods/PakReader/ExportObject/AssetReader.cs#L275

    const hasGuid = await reader.read(ByteBoolean);
    let propertyGuid = null;

    if (hasGuid) {
      propertyGuid = await reader.read(FGuid);
    }

    let tag = null;

    let fullyRead = true;

    if (shouldRead && baseTag.size > 0) {
      const currentPos = reader.position;
      reader.trackReads();
      tag = await reader.read(Tag(asset, baseTag.propertyType, tagMetaData as TagMetaData, depth + 1, baseTag.size, reader));

      if (reader.getTrackedBytesRead() !== BigInt(baseTag.size)) {
        console.error(
          `${baseTag.name} (${
            baseTag.propertyType
          }) property not read fully, ${reader.getTrackedBytesRead()}/${baseTag.size} bytes read.`,
        );

        fullyRead = false;

        if (reader.getTrackedBytesRead() > baseTag.size) {
          throw new Error('More bytes were read than available!');
        }
      }
      reader.untrackReads();
      await reader.seekTo(currentPos + BigInt(baseTag.size));
    }

    // Swap the meta and the data fields for boolean
    if (baseTag.propertyType === 'BoolProperty') {
      tag = tagMetaData;
      tagMetaData = null;
    }

    return {
      ...baseTag,
      tagMetaData,
      propertyGuid,
      tag: shouldRead ? tag : tagMetaData,
      fullyRead
    };
  };
}

const incompletelyReadPropertiesSet = new Set<string>();
export const incompletelyReadProperties = [] as string[]

export function Tag(asset: UAsset, propertyType: string, tagMetaData: TagMetaData, depth: number, readSize: number, trackingReader: Reader) {
  return async function (reader: Reader) {
    let tag = null;

    if (propertyType === 'BooleanProperty') {
      // TODO: Should we return the metadata?
    } else if (propertyType === 'BoolProperty') {
      // TODO: should we return the metadata?
    } else if (propertyType === 'Int8Property') {
      tag = await reader.read(Int8);
    } else if (propertyType === 'Int16Property') {
      tag = await reader.read(Int16);
    } else if (propertyType === 'IntProperty') {
      tag = await reader.read(Int32);
    } else if (propertyType === 'Int64Property') {
      tag = bigintToNumber(await reader.read(Int64));
    } else if (propertyType === 'ByteProperty') {
      // if (size === 4 || size === -4) {
      //   tag = await reader.read(UInt32);
      // } else if (size == 8) {
      //   // Is this actually an enum?
      //   // https://github.com/EpicGames/UnrealEngine/blob/6c20d9831a968ad3cb156442bebb41a883e62152/Engine/Source/Runtime/CoreUObject/Private/UObject/PropertyByte.cpp#L70-L79
      //   tag = await reader.read(EnumProperty(names));
      // }

      if (tagMetaData && tagMetaData !== 'None') {
        // https://github.com/iAmAsval/FModel/blob/05e7b0a6dae81c3a7769ed68add0dbfd49b02745/FModel/Methods/PakReader/ExportObject/AssetReader.cs#L350
        // ??? looks sam e as above
        tag = await reader.read(FName(asset.names));
      } else {
        tag = await reader.read(ByteProperty);
      }
    } else if (propertyType === 'EnumProperty') {
      if (tagMetaData && tagMetaData !== 'None') {
        // Is actually an enum
        tag = await reader.read(EnumProperty(asset.names));
      } else {
        // It's "None" which isn't serialized
        return tag;
      }
    } else if (propertyType === 'UInt16Property') {
      tag = await reader.read(UInt16);
    } else if (propertyType === 'UInt32Property') {
      tag = await reader.read(UInt32);
    } else if (propertyType === 'UInt64Property') {
      tag = await reader.read(UInt64);
    } else if (propertyType === 'FloatProperty') {
      tag = await reader.read(Float);
    } else if (propertyType === 'DoubleProperty') {
      tag = await reader.read(Double);
    } else if (propertyType === 'ArrayProperty') {
      tag = await reader.read(UScriptArray(tagMetaData as Shape<typeof UScriptArrayMetaData>, asset, depth, readSize, trackingReader));
    } else if (propertyType === 'ObjectProperty') {
      tag = await reader.read(FPackageIndex(asset.imports, asset.exports));
    } else if (propertyType === 'StructProperty') {
      tag = await reader.read(
        UScriptStruct(tagMetaData as Shape<typeof StructPropertyTagMetaData>, asset, depth, readSize, trackingReader),
      );
    } else if (propertyType === 'InterfaceProperty') {
      tag = await reader.read(InterfaceProperty);
    } else if (propertyType === 'TextProperty') {
      tag = await reader.read(FText(asset.names));
    } else if (propertyType === 'StrProperty') {
      tag = await reader.read(FString);
    } else if (propertyType === 'NameProperty') {
      tag = await reader.read(FName(asset.names));
    } else if (propertyType === 'SetProperty') {
      tag = await reader.read(
        SetProperty(tagMetaData as Shape<typeof SetPropertyTagMetaData>, asset, depth, readSize, trackingReader),
      );
    } else if (propertyType === 'MapProperty') {
      tag = await reader.read(
        MapProperty(tagMetaData as Shape<typeof MapPropertyTagMetaData>, asset, depth, readSize, trackingReader),
      );
    } else if (propertyType === 'DelegateProperty') {
      tag = await reader.read(DelegateProperty(asset.names));
    } else if (propertyType === 'SoftObjectProperty') {
      tag = await reader.read(FSoftObjectPath(asset.names));
    } else if (propertyType === 'MulticastDelegateProperty') {
      tag = await reader.read(Int32);
    } else if (propertyType === 'MulticastSparseDelegateProperty') {
      tag = await reader.read(MulticastDelegateProperty(asset.names, asset.imports, asset.exports, readSize))
    } else if (propertyType === 'FieldPathProperty') {
      tag = await reader.read(FieldPathProperty(asset.names));
    } else {
      console.log(tagMetaData);
      throw new Error(`Unparsed Property type ${propertyType}`);
    }

    return tag;
  };
}

export async function readFPropertyTagLoop(reader: Reader, asset: UAsset): Promise<any[]> {
  const propertyList: Shape<typeof FPropertyTag>[] = [];
  for (; ;) {
    const property = await reader.read(FPropertyTag(asset, true, 0));
    if (!property) {
      break;
    }

    propertyList.push(property);
  }

  return propertyList;
}
