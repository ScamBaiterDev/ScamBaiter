import axios from 'axios'
import config from './config.json'

import fs from 'node:fs/promises'
import { DBPath, db, setLastUpdate } from './bot'

export const updateDb = async () => {
  try {
    const scamAPIRESP = await axios.get(config.scamApi, {
      headers: {
        'User-Agent': 'ScamBaiter/1.0; Chris Chrome#9158'
        // Mozilla/5.0 (compatible; <botname>/<botversion>; +<boturl>)
      }
    })

    await fs.writeFile(DBPath, JSON.stringify(scamAPIRESP.data))
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
