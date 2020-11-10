/**
 * Parser and content of a .uexp file.
 *
 */
import {UAsset} from "./UAsset";
import {Reader} from "../../readers/Reader";
import {UExports} from "./UExports";

export class UObject {
  constructor(public uasset: UAsset, private uexpReader: Reader, private ubulkReader?: Reader) {}

  public uexports: UExports[] = [];

  async initialize() {
    for (const exp of this.uasset.exports) {
      this.uexpReader.seekTo(exp.serialOffset - this.uasset.summary.totalHeaderSize);

      const className = this.uasset.getClassNameFromExport(exp);
      const baseObject = new UExports(this.uexpReader, this.uasset, className, true);
      await baseObject.initialize();

      this.uexports.push(baseObject);

      // let itemToPush: UObjectBase;
      // if (className === 'Texture2D') {
      //   const texture2DFile = new UTexture2D(result.reader, bulkReader as ChildReader, asset);
      //   await texture2DFile.initialize();
      //   itemToPush = texture2DFile;
      //   fileType = 'Texture2D';
      // } else if (className === 'DataTable') {
      //   //Data Table
      //   const DataTableFile = new UDataTable(result.reader, asset);
      //   await DataTableFile.initialize();
      //   itemToPush = DataTableFile;
      //   fileType = 'DataTable';
      // } else {
      //   const baseObject = new UObjectBase(result.reader, asset, className, true);
      //   // console.log(asset.filename);
      //   await baseObject.initialize();
      //   itemToPush = baseObject;
      // }
      //
      // // TODO: fix this with a flag maybe? This is basically to remove all the freaking empty properties.
      // if (itemToPush.propertyList.length) {
      //   exports.push(itemToPush);
      // }
    }
  }
}