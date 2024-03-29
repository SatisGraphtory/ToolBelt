import {Reader} from "../../../readers/Reader";
import {Int32} from "../../primitive/integers";
import {FByteBulkData} from "./FByteBulkData";
import {FString} from "../../containers/FString";

export function FTexture2DMipMap(ubulkReader: Reader | undefined, bulkOffset: bigint) {
  return async function FTexture2DMipMapParser(reader: Reader) {
    const cooked = await reader.read(Int32);
    const bulkData = await reader.read(FByteBulkData(ubulkReader, bulkOffset));
    const sizeX = await reader.read(Int32);
    const sizeY = await reader.read(Int32);
    const sizeZ = await reader.read(Int32);

    if (cooked !== 1) {
      await reader.read(FString);
    }

    return {
      sizeX,
      sizeY,
      sizeZ,
      bulkData,
    };
  };
}