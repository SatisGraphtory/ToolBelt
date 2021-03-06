#!/usr/bin/env node
import {exiftool} from 'exiftool-vendored';

const DEFAULT_EXE_PATH = '/mnt/a/Games/Epic/SatisfactoryExperimental/FactoryGame.exe';
main();

async function main() {
  const exeFilePath = process.env.EXE_PATH || DEFAULT_EXE_PATH;
  exiftool
    .read(exeFilePath)
    .then(tags =>
      console.log(tags))
    .catch(err => console.error('Something terrible happened: ', err));
}
