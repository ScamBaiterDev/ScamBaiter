import axios from 'axios'
import config from './config.json'

import { opendir, writeFile } from 'node:fs/promises'
import { DBPath, db, setLastUpdate } from './bot'

export const updateDb = async () => {
  try {
    const scamAPIRESP = await axios.get(config.scamApi, {
      headers: {
        'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158'
        // Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
      }
    })

    await writeFile(DBPath, JSON.stringify(scamAPIRESP.data))
    db.length = 0
    db.push(...scamAPIRESP.data)
    setLastUpdate(new Date())
    console.info(`[${Date.now()}] Updated DB!`)
    return scamAPIRESP.data
  } catch (e) {
    db.length = 0
    db.push(...require(DBPath))
    console.error(`[${Date.now()}] Failed To Update the DB: e`)
  }
}

// eslint-disable-next-line prefer-regex-literals, no-useless-escape
export const urlRegex = new RegExp(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g)

export async function walk (dir: string, filter?: RegExp): Promise<string[]> {
  const files: string[] = []
  const dirEntries = await opendir(dir)
  for await (const dirEntry of dirEntries) {
    if (dirEntry.isFile()) {
      if (filter && !filter.test(dirEntry.name)) continue
      files.push(dir + '/' + dirEntry.name)
    } else if (dirEntry.isDirectory()) {
      files.push(...await walk(dir + '/' + dirEntry.name, filter))
    }
  }
  return files
}
