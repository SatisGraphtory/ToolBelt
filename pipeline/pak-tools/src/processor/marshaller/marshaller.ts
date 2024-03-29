import {Shape} from '../../util/parsers';
import {FPropertyTag} from "../../pak/structs/UScript/FPropertyTag";
import {classReference} from "../../../../headers-to-interfaces/emit/native/references";
import {getJsonForObject} from "../loader/jsonLoader";
import {UScriptArray, UScriptArrayMetaData} from "../../pak/structs/UScript/UScriptStrutTypes/UScriptArray";
import {getPackageAndFilenameFromPath, resolveSlugFromPackageReference} from "../resolvers/resolveSlugs";
import {PakFile} from "../../pak/PakFile";
import consoleInspect from "../../util/consoleInspect";
import * as SatisfactoryEnums from '../../../../../.DataLanding/interfaces';
import {marshallObject} from "./genericMarshaller";
import {UExports} from '../../pak/pakfile/UExports';

export class Marshaller {
  public dependencies: Set<string> = new Set();
  missingDependencies = new Map<string, any>();
  possiblyMissingDependencies = new Map<string, any>();
  allSeenPropertyKeys = new Set<string>();
  missingPropertyKeys = new Set<string>();
  alreadyProcessedExports = new Set<string>();

  constructor(private pakFile: PakFile) {
  }

  private static defaultsAreEqual(a: any, b: any) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;

      // If you don't care about the order of the elements inside
      // the array, you should sort both arrays here.
      // Please note that calling sort on an array will modify that array.
      // you might want to clone your array first.

      for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    return a?.size === 0 && b?.size === 0;
  }

  getDependencies(): string[] {
    return [...this.dependencies];
  }

  reconcileMissingDependencies() {
    for (const [key, value] of this.possiblyMissingDependencies.entries()) {
      if (!this.missingDependencies.has(key)) {
        this.addMissingDependency(key, value)
      }
    }
  }

  addMissingDependency(dependencyKey: string, dependencyValue: any, isBackupDocObjectKey: boolean = false) {
    if (isBackupDocObjectKey) {
      this.possiblyMissingDependencies.set(dependencyKey, dependencyValue);
      return;
    }

    if (this.missingDependencies.has(dependencyKey)) return;
    if (Array.isArray(dependencyValue)) {
      this.missingDependencies.set(dependencyKey, []);
    } else {
      switch (typeof dependencyValue) {
        case 'number':
          this.missingDependencies.set(dependencyKey, 0);
          break;
        case 'object':
          this.missingDependencies.set(dependencyKey, null);
          break;
        case 'boolean':
          this.missingDependencies.set(dependencyKey, false);
          break;
        case 'string':
          if (dependencyValue.toLowerCase() === 'true' || dependencyValue.toLowerCase() == 'false') {
            console.log(dependencyKey);
            throw new Error("Found bad booleans");
          }
          this.missingDependencies.set(dependencyKey, null);
          break;
        default:
          break;
      }
    }


    // if (this.missingDependencies.has(dependencyKey)) {
    //   if (!Marshaller.defaultsAreEqual(this.missingDependencies.get(dependencyKey), dependencyValue)) {
    //     if (typeof dependencyValue !== typeof this.missingDependencies.get(dependencyKey)) {
    //       if (dependencyValue === 'None' || this.missingDependencies.get(dependencyKey) === 'None') {
    //         this.blacklistedMissingDependencies.add(dependencyKey);
    //         this.missingDependencies.set(dependencyKey, 'None');
    //         return;
    //       } else {
    //         if (typeof dependencyValue === 'object' && typeof this.missingDependencies.get(dependencyKey) === 'string') {
    //           this.blacklistedMissingDependencies.add(dependencyKey);
    //           this.missingDependencies.delete(dependencyKey);
    //           return;
    //         }
    //         console.log(dependencyKey, dependencyValue, this.missingDependencies.get(dependencyKey));
    //         throw new Error("Mismatched dep types!")
    //       }
    //     }
    //
    //     this.blacklistedMissingDependencies.add(dependencyKey);
    //
    //     if (Array.isArray(dependencyValue)) {
    //       this.missingDependencies.set(dependencyKey, []);
    //     } else {
    //       switch (typeof dependencyValue) {
    //         case 'number':
    //           this.missingDependencies.set(dependencyKey, 0);
    //           break;
    //         case 'object':
    //           this.missingDependencies.set(dependencyKey, null);
    //           break;
    //         case 'boolean':
    //           this.missingDependencies.set(dependencyKey, false);
    //           break;
    //         case 'string':
    //           if (dependencyValue.toLowerCase() === 'true' || dependencyValue.toLowerCase() == 'false') {
    //             console.log(dependencyKey);
    //             throw new Error("Found bad booleans");
    //           }
    //           this.missingDependencies.set(dependencyKey, null);
    //           break;
    //         default:
    //           console.log(this.missingDependencies.get(dependencyKey))
    //           console.log(dependencyValue);
    //           throw new Error("Unknown dep value type " + typeof dependencyValue + " for key " + dependencyKey);
    //       }
    //     }
    //
    //     console.log(`Received conflicting defaults for key ${dependencyKey}, setting as empty instead.`);
    //   }
    // } else {
    //   switch (typeof dependencyValue) {
    //     case 'number':
    //       this.missingDependencies.set(dependencyKey, false);
    //       break;
    //     case 'boolean':
    //       this.missingDependencies.set(dependencyKey, false);
    //       break;
    //     default:
    //       this.missingDependencies.set(dependencyKey, dependencyValue);
    //   }
    //
    // }
  }

  determineAndAddMissingDependencies<T>(marshalledItems: T[]) {
    this.determineMissingDependencies<T>(marshalledItems);
    this.populateMissingDependencies<T>(marshalledItems);
    this.reconcileMissingDependencies();
    this.injectMissingDependencies<T>(marshalledItems);
  }

  determineMissingDependencies<T>(marshalledItems: T[]) {
    for (const marshalledItem of marshalledItems) {
      for (const dep of this.allSeenPropertyKeys) {
        if ((marshalledItem as any)[dep] === undefined) {
          this.missingPropertyKeys.add(dep);
        }
      }
    }
  }

  populateMissingDependencies<T>(marshalledItems: T[]) {
    for (const marshalledItem of marshalledItems) {
      for (const dep of this.missingPropertyKeys) {
        if ((marshalledItem as any)[dep] !== undefined) {
          this.addMissingDependency(dep, (marshalledItem as any)[dep]);
        }
      }
    }
  }

  injectMissingDependencies<T>(marshalledItems: T[]) {
    for (const marshalledItem of marshalledItems) {
      for (const dep of this.missingDependencies.keys()) {
        if ((marshalledItem as any)[dep] === undefined) {
          (marshalledItem as any)[dep] = this.missingDependencies.get(dep);
        }
      }
    }
  }

  async marshalFromPropertyList<T>(propertyList: Shape<typeof FPropertyTag>[],
                                   className: string,
                                   docObject: Record<string, any>,
                                   additionalClasses: UExports[],
                                   topLevel: boolean
  ): Promise<T> {
    let namesToProcess = new Set<string>();
    let classMeta: any = {};
    try {
      classMeta = getJsonForObject(`${className}`);
      namesToProcess = new Set(Object.keys(classMeta.properties || {}));
    } catch (e) {
    }

    const completeKeySet = new Set([...namesToProcess, ...Object.keys(docObject)]);

    const marshalledObject = <T>{}

    for (const prop of propertyList) {
      const propName = prop?.name as string;
      completeKeySet.delete(propName);
      (marshalledObject as any)[propName] = await this.marshalPropertyByPakType(prop, docObject, prop?.propertyType, additionalClasses);
      this.allSeenPropertyKeys.add(propName)
    }

    for (const field of completeKeySet) {
      if (!field.startsWith('m')) {
        completeKeySet.delete(field);
      }
    }

    if (topLevel) {
      for (const missingKey of completeKeySet) {
        if (docObject[missingKey]) {
          (marshalledObject as any)[missingKey] = docObject[missingKey];
          this.addMissingDependency(missingKey, docObject[missingKey], true);
          this.allSeenPropertyKeys.add(missingKey);
        }
      }
    }

    return marshalledObject;
  }

  public async marshalSoftClassReferenceString(objectPath: string) {
    const classNameParts = objectPath.split('.');

    classNameParts.pop();

    return await this.marshalClassReferenceTraversal({
      objectName: classNameParts.join('.')
    });
  }

  async marshalSoftObjectProperty(property: Shape<typeof FPropertyTag>) {
    if (property?.tag?.subpath) {
      throw new Error("Not enough data");
    }

    if (property?.tag?.assetPathName === 'None') {
      return null
    }

    if (property?.tag?.assetPathName.startsWith('/Script')) {
      const filePath = property.tag.assetPathName;
      if (filePath.indexOf('.') == -1) throw new Error("Unknown script found: " + filePath);

      const filePathParts = filePath.split('.');
      const fileNameToFind = filePathParts.pop();

      let foundEntry = null as any;
      for (const entry of this.pakFile.entries.keys()) {
        if (entry.toLowerCase().includes(fileNameToFind.toLowerCase() + ".")) {
          console.log(entry, foundEntry);
          if (foundEntry) throw new Error("Multiple files found for " + fileNameToFind);

          foundEntry = entry
        }
      }

      if (foundEntry) {
        console.log(foundEntry);
        throw new Error("Okay, what now");
      } else {
        for (const entry of this.pakFile.entries.keys()) {
          if (entry.includes(fileNameToFind)) {
            if (foundEntry) throw new Error("Multiple files found for " + fileNameToFind);
            foundEntry = entry;
          }
        }

        if (foundEntry) {
          console.log(fileNameToFind);
          throw new Error("Could not find a suitable thing");
        } else {
          return {
            // In-place replacement of the proper pakfile structure
            package: filePathParts.join('.'),
            name: fileNameToFind,
            slug: await resolveSlugFromPackageReference({
              package: filePathParts.join('.'),
              name: fileNameToFind,
              slug: ''
            }, this.pakFile)
          };
        }
      }
    }

    return await this.marshalSoftClassReferenceString(property?.tag?.assetPathName);
  }

  marshalEnums(property: Shape<typeof FPropertyTag>) {
    const [namespace, enumName] = property!.tag.split('::');

    if ((SatisfactoryEnums as any)[namespace] === undefined) {
      console.error(`Could not find enum namespace ${namespace} (maybe you need to update?)`);
      return 0;
    }

    if ((SatisfactoryEnums as any)[namespace][enumName] === undefined) {
      throw new Error(`Could not find enum named ${enumName} in ${namespace} (maybe you need to update?)`);
    }

    return (SatisfactoryEnums as any)[namespace][enumName]
  }

  async marshalClassReference(property: Shape<typeof FPropertyTag>): Promise<null | classReference<any>> {
    // It's a classReference

    // Invalid
    // {
    //   classPackage: '/Script/Engine',
    //     className: 'SplineComponent',
    //   outerIndex: -3,
    //   objectName: 'SplineComponent',
    //   outerReference: {
    //   reference: {
    //     classPackage: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk1/Build_ConveyorBeltMk1',
    //       className: 'Build_ConveyorBeltMk1_C',
    //       outerIndex: -17,
    //       objectName: 'Default__Build_ConveyorBeltMk1_C',
    //       outerReference: {
    //       reference: {
    //         classPackage: '/Script/CoreUObject',
    //           className: 'Package',
    //           outerIndex: 0,
    //           objectName: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk1/Build_ConveyorBeltMk1',
    //           outerReference: { reference: null, index: 0 }
    //       },
    //       index: 16
    //     }
    //   },
    //   index: 2
    // }
    // }

    //Valid
    // {
    //   classPackage: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk1/Build_ConveyorBeltMk1',
    //     className: 'Build_ConveyorBeltMk1_C',
    //   outerIndex: -17,
    //   objectName: 'Default__Build_ConveyorBeltMk1_C',
    //   outerReference: {
    //   reference: {
    //     classPackage: '/Script/CoreUObject',
    //       className: 'Package',
    //       outerIndex: 0,
    //       objectName: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk1/Build_ConveyorBeltMk1',
    //       outerReference: { reference: null, index: 0 }
    //   },
    //   index: 16
    // }
    // }

    if (property?.tag?.reference) {
      return await this.marshalClassReferenceTraversal(property.tag.reference);
    }

    return (await this.marshalClassReferenceTraversal((property as any)?.reference) as any);
  }

  async parseDependencyAndAddToList(fullPath: string) {
    let {pathMain, fileName} = getPackageAndFilenameFromPath(fullPath);

    this.dependencies.add([pathMain, fileName].join('/'));

    return {
      // In-place replacement of the proper pakfile structure
      package: pathMain,
      name: fileName,
      slug: await resolveSlugFromPackageReference({package: pathMain, name: fileName, slug: ''}, this.pakFile)
    };
  }

  async marshalClassReferenceTraversal(traversalNode: any) {
    if (!traversalNode) return null;
    let usedTraversalNode = traversalNode;
    let previousTraversalNode = null as any;

    let usedClassName = traversalNode.objectName;

    if (traversalNode?.outerReference?.reference !== undefined &&
      traversalNode?.outerReference?.index !== undefined) {
      while (usedTraversalNode?.outerReference?.reference) {
        previousTraversalNode = usedTraversalNode;
        usedTraversalNode = usedTraversalNode.outerReference.reference;
        usedClassName = usedTraversalNode.objectName;
      }
    } else {
      while (usedTraversalNode.outerReference) {
        previousTraversalNode = usedTraversalNode;
        usedTraversalNode = usedTraversalNode.outerReference;
        usedClassName = usedTraversalNode.objectName;
      }
    }

    let nameWithoutClassSuffix = usedClassName.replace(/_C$/, '')
      .replace(/^\/Engine\//, 'Engine/Content/')
      .replace(/^\/Game\//, 'FactoryGame/Content/')
      .replace(/^Default__/, '');

    for (const entry of this.pakFile.entries.keys()) {
      if (entry.toLowerCase().includes(nameWithoutClassSuffix.toLowerCase() + ".")) {
        return await this.parseDependencyAndAddToList(entry);
      }
    }

    if (!previousTraversalNode) {
      let baseInfer = traversalNode.classPackage;

      if (!baseInfer && traversalNode.objectName) {
        if (traversalNode.objectName.startsWith("BlueprintGeneratedClass")) {
          baseInfer = traversalNode.objectName.replace("BlueprintGeneratedClass'", "");
        }
      }

      if (baseInfer) {
        const classPackage = baseInfer
          .replace(/_C$/, '')
          .replace(/^\/Engine\//, 'Engine/Content/')
          .replace(/^\/Game\//, 'FactoryGame/Content/')
          .replace(/^Default__/, '');
        console.log(classPackage);
        for (const entry of this.pakFile.entries.keys()) {
          if (entry.toLowerCase().includes(classPackage.toLowerCase() + ".")) {
            return await this.parseDependencyAndAddToList(entry);
          }
        }
      }

      consoleInspect(traversalNode);
      throw new Error("Unknown because no previous traversal.")
    }

    if (nameWithoutClassSuffix.indexOf("/") !== -1) {
      let separatedName = nameWithoutClassSuffix.split('/');
      separatedName.pop()
      separatedName.push(previousTraversalNode.objectName);
      separatedName = separatedName.join('/').replace(/_C$/, '')
        .replace(/^\/Engine\//, 'Engine/Content/')
        .replace(/^\/Game\//, 'FactoryGame/Content/')
        .replace(/^Default__/, '');

      for (const entry of this.pakFile.entries.keys()) {
        if (entry.toLowerCase().includes(separatedName.toLowerCase() + ".")) {
          return await this.parseDependencyAndAddToList(entry);
        }
      }

      const imageRegex = new RegExp(separatedName.replace(/\//g, '/') + "_([0-9]+)\\.", 'g');

      const versions = new Map<number, string>();

      let found = false;
      for (const entry of this.pakFile.entries.keys()) {
        const match = imageRegex.exec(entry);
        if (match) {
          await this.parseDependencyAndAddToList(entry);
          versions.set(parseInt(match[1]), entry);
          found = true;
        }
      }

      if (found) {
        const allVersions = [...versions.keys()].sort();
        return await this.parseDependencyAndAddToList(versions.get(allVersions[0])!);
      }

      if (nameWithoutClassSuffix.startsWith('/Script')) return null;

      console.log("Invalid name found", separatedName, found, separatedName.replace(/\//g, '//') + "_[0-9]+\\.")
      console.log(nameWithoutClassSuffix);
      consoleInspect(traversalNode);
      throw new Error("Unimplemented marshaller for non-file");
    } else {
      for (const entry of this.pakFile.entries.keys()) {
        if (entry.toLowerCase().includes(nameWithoutClassSuffix.toLowerCase() + ".")) {
          return await this.parseDependencyAndAddToList(entry);
        }
      }

      console.log(nameWithoutClassSuffix, traversalNode)

      throw new Error("Really not implemented :(");
    }
  }

  private async marshalArrayProperty(property: Shape<typeof FPropertyTag>,
                                     docObject: Record<string, any>, additionalClasses: UExports[]) {
    const {innerType} = property?.tagMetaData as Shape<typeof UScriptArrayMetaData>;

    const returnedArray: any[] = [];

    for (const arrayEntry of property?.tag as Shape<typeof UScriptArray>) {
      if (Array.isArray(arrayEntry)) {
        returnedArray.push(await this.marshalFromPropertyList<any>(arrayEntry, innerType, docObject, additionalClasses, false))
      } else {
        const parsedArrayItem = await this.marshalPropertyByPakType({
          tag: arrayEntry,
          propertyType: innerType,
          name: "DUMMY_INVALID_NAME"
        } as unknown as Shape<typeof FPropertyTag>, docObject, innerType, additionalClasses);

        if (parsedArrayItem !== null) {
          if (typeof parsedArrayItem === 'object' && parsedArrayItem?.DUMMY_INVALID_NAME !== undefined) {
            returnedArray.push(parsedArrayItem.DUMMY_INVALID_NAME);
          } else {
            returnedArray.push(parsedArrayItem);
          }
        }
      }
    }

    return returnedArray;
  }

  private async marshalStructProperty(property: Shape<typeof FPropertyTag>, docObject: Record<string, any>,
                                      additionalClasses: UExports[]) {
    const propertyMap = {} as Record<string, any>;

    if (Array.isArray(property?.tag)) {
      if (property?.tag.length) {
        for (const subProperty of property!.tag) {
          if (subProperty.tagMetaData !== undefined && subProperty.propertyGuid !== undefined) {

            // We need to handle structs a little bit differently
            if (subProperty.propertyType === 'StructProperty') {
              propertyMap[subProperty!.name] = await this.marshalStructProperty(subProperty, docObject, additionalClasses)
              //
              // for(let [retrievedKey, retrievedValue] of ) {
              //   if (propertyMap[retrievedKey] !== undefined) {
              //     consoleInspect(property);
              //     throw new Error("This property map already has the key " + retrievedKey);
              //   }
              //   propertyMap[retrievedKey] =  retrievedValue;
              // }
            } else {
              propertyMap[subProperty!.name] = await this.marshalPropertyByPakType(subProperty, docObject,
                subProperty?.propertyType, additionalClasses);
            }
          } else {
            const propertyTag = (property!.tag as any)
            await this.marshalPropertyByPakType(propertyTag, docObject, propertyTag?.propertyType, additionalClasses);
            break;
          }
        }
      } else {
        propertyMap[property!.name] = [];
      }
    } else {
      if (property?.tag?.tagMetaData !== undefined && property?.tag?.propertyGuid !== undefined) {
        propertyMap[property!.name] = await this.marshalPropertyByPakType(property.tag, docObject, property.tag?.propertyType,
          additionalClasses);
      } else {
        // TODO: set metadata?
        propertyMap[property!.name] = property!.tag;
      }
    }

    return propertyMap;
  }

  // InnerType may be redundant because we pass in some sketchy stuff
  private async marshalPropertyByPakType(property: Shape<typeof FPropertyTag>,
                                         docObject: Record<string, any>, overriddenPropertyType: any,
                                         additionalClasses: UExports[]) {
    if (!property) return null;
    switch (overriddenPropertyType) {
      case 'EnumProperty':
        return this.marshalEnums(property);
      case 'ArrayProperty':
        return await this.marshalArrayProperty(property, docObject, additionalClasses);
      case 'ObjectProperty':
        const objectName = property?.tag?.reference?.objectName;

        const usedExport = additionalClasses.filter((clazz: any) => {
          return clazz.exportTypes === objectName || clazz.aliasExportTypes.has(objectName)
        });

        if (usedExport.length) {
          let actualExport = usedExport[0];

          let importIndex = -1;

          if (usedExport.length > 1) {
            actualExport = usedExport.filter((exp) => {
              return !this.alreadyProcessedExports.has(exp.exportTypes + exp.uuid);
            })[0];

            importIndex = usedExport.indexOf(actualExport);

            if (!actualExport) {
              console.log("FOUND MORE THAN ONE EXPORT BUT WE ALREADY SAW", this.alreadyProcessedExports);
              console.log(usedExport);
              process.exit(1);
            }
            this.alreadyProcessedExports.add(actualExport.exportTypes + actualExport.uuid);
          }

          const thisFilename = actualExport.asset.filename;

          const uObject = (await this.pakFile.getFiles([thisFilename]))![0];

          const marshalledObject = await marshallObject<any>(this.pakFile, uObject,
            {},
            this, actualExport.exportTypes, true,
            actualExport.exportTypes);

          if (marshalledObject.objects.length > 1) {
            if (importIndex === -1) {
              console.log("TOO MANY OBJECTS but import index is -1");
              console.log(thisFilename);
              consoleInspect(marshalledObject);
              process.exit(1);
            }

            if (marshalledObject.objects[importIndex] === undefined) {
              console.log("Import obj undefined");
              console.log(thisFilename);
              consoleInspect(marshalledObject);
              process.exit(1);
            }

            return marshalledObject.objects[importIndex].object
          }

          if (!marshalledObject.objects) {
            return null;
          }

          return marshalledObject.objects[0].object;
        }

        return await this.marshalClassReference(property);
      case 'StructProperty':
        return await this.marshalStructProperty(property, docObject, additionalClasses);
      case 'SoftObjectProperty':
        return await this.marshalSoftObjectProperty(property);
      case 'TextProperty':
      case 'BoolProperty':
      case 'IntProperty':
      case 'FloatProperty':
      case 'UInt64Property':
      case 'ByteProperty':
      case 'NameProperty':
        return property.tag;
      default:
        if (property.tag === [] || property.tag === {}) return property.tag;
        // if (typeof property.tag !== 'string' && typeof property.tag !== 'number') {
        //   console.log("Unknown property type", overriddenPropertyType, property);
        //   throw new Error("Non string property type!")
        // }
        return property.tag;
    }
  }

  //
  // marshalClassTagTraversal(traversalNode: any) {

  // return this.marshalClassReferenceTraversal(traversalNode);
  // let previousTraversalNode = null as any;
  //
  // consoleInspect(traversalNode);
  //
  // while (traversalNode.outerReference?.reference) {
  //   previousTraversalNode = traversalNode;
  //   traversalNode = traversalNode.outerReference.reference;
  // }
  //
  // const firstThingPath = traversalNode.objectName.split('/');
  //
  // const firstThingName = firstThingPath.pop().replace(/_C$/g, '');
  // const firstThingPkg = firstThingPath.join('/').replace('/Game/', 'FactoryGame/Content/');
  //
  // this.dependencies.add([firstThingPkg, firstThingName].join('/'));
  //
  // return {
  //   // In-place replacement of the proper pakfile structure
  //   package: firstThingPkg,
  //   name: firstThingName,
  //   slug: resolveSlugFromPackageReference({package: firstThingPkg, name: firstThingName})
  // };
  //


  // if (traversalNode.classPackage && traversalNode.classPackage.indexOf('/') !== -1) {
  //   const testThing = traversalNode.classPackage.split('/');
  //   const testThingName = testThing.pop();
  //   const testThingPackage = testThing.join('/').replace('/Game/', 'FactoryGame/Content/');
  //
  //   this.dependencies.add([testThingPackage, testThingName].join('/'));
  //
  //   return {
  //     // In-place replacement of the proper pakfile structure
  //     package: testThingPackage,
  //     name: testThingName,
  //     slug: resolveSlugFromPackageReference({package: testThingPackage, name: testThingName})
  //   };
  // } else {
  //   console.log(traversalNode);
  //   for (const entry of this.pakFile.entries.keys()) {
  //     if (entry.includes(traversalNode.classPackage)) {
  //       console.log(entry);
  //       console.log(traversalNode);
  //     }
  //   }
  //
  //   throw new Error("Unimplemented");
  // }

  // }
}
