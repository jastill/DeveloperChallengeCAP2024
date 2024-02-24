// Use as a module, import instead of require
import cds from '@sap/cds'
import * as path from 'path'
import { existsSync as fileExists } from 'fs'
import { fileURLToPath } from 'url'
import upath from 'upath'
import { glob } from 'glob'
import express from 'express'

// @ts-ignore
const __dirname = fileURLToPath(new URL('.', import.meta.url))
global.__base = __dirname
let app

cds
  .on('bootstrap', async function (_app) {
    app = _app
    let expressFile = path.join(__dirname, './server/express.js')
    if (fileExists(expressFile)) {
      const { default: expressFileExc } = await import(`file://${expressFile}`)
      expressFileExc(app, cds)
    }
  })

  .on('serving', service => {
    addLinkToGraphQl(service)

    app.use('/model/', async (req, res) => {
      const csn = await cds.load('db')
      const model = cds.reflect(csn)
      res.type('json')
      res.send(JSON.stringify(model))
    })
  })

/**
 * Add the link to the GraphQl Playground to the service
 * @param {} service 
 */
function addLinkToGraphQl(service) {
  const provider = (entity) => {
    if (entity) return // avoid link on entity level, looks too messy
    
    // Check for the protocols existing. Not sure if this will be present for shortcut @graphql
    if (!service.definition["@protocol"]) return
    if (service.definition["@protocol"].includes('graphql') ) return { href: 'graphql', name: 'GraphQL', title: 'Show in GraphQL' }
    return 
  }
  // Needs @sap/cds >= 4.4.0
  service.$linkProviders ? service.$linkProviders.push(provider) : service.$linkProviders = [provider]
}

export default async function (o) {
  o.app = express()
  o.app.httpServer = await cds.server(o)
  //Load routes
  let routesDir = path.join(__dirname, './routes/**/*.js')
  let files = await glob(upath.normalize(routesDir))
  if (files.length !== 0) {
    let modules = await Promise.all(
     files.map((file) => {
        cds.log('nodejs').info(`Loading: ${file}`)
        return import(`file://${file}`)
      })
    )
    modules.forEach((module) => module.load(o.app, o.app.httpServer))
  }
  return o.app.httpServer
}