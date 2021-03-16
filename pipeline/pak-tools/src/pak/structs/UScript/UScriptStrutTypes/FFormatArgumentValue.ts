import {FText} from "./FText";
import {Double, Float} from "../../../primitive/decimals";
import {Int64, UInt64, UInt8} from "../../../primitive/integers";
import {Reader} from "../../../../readers/Reader";
import {NameMap} from "../FName";

export enum EFormatArgumentType {
  Int,
  UInt,
  Float,
  Double,
  Text,
  Gender,
  // Add new enum types at the end only! They are serialized by index.
}

export function FFormatArgumentValue(names: NameMap) {
  return async function FFormatArgumentValueParser(reader: Reader) {
    const Type = await reader.read(UInt8) as EFormatArgumentType;
    switch (Type) {
      case EFormatArgumentType.Text:
        return await reader.read(FText(names));
      case EFormatArgumentType.Int:
        return await reader.read(Int64);
      case EFormatArgumentType.UInt:
        return await reader.read(UInt64);
      case EFormatArgumentType.Double:
        return await reader.read(Double);
      case EFormatArgumentType.Float:
        return await reader.read(Float);
      default:
        throw new Error('Unimplemented FFormatArgumentValue type: ' + Type);
    }
  };
}
