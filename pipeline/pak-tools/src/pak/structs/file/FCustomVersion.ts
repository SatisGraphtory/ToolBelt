// https://github.com/SatisfactoryModdingUE/UnrealEngine/blob/4.22-CSS/Engine/Source/Runtime/Core/Private/Serialization/CustomVersion.cpp#L112-L117
import {Reader} from "../../../readers/Reader";
import {FGuid} from "../UScript/UScriptStrutTypes/FGuid";
import {Int32} from "../../primitive/integers";

export async function FCustomVersion(reader: Reader) {
  return {
    key: await reader.read(FGuid),
    version: await reader.read(Int32),
  };
}
