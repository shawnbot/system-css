#!/usr/bin/env node
const {resolve} = require('path')
const {promisify} = require('util')
const readFile = promisify(require('fs').readFile)
const yargs = require('yargs')

const {_: args, ...options} = yargs.argv
const generate = require('../src/generate')

loadTheme(args[0], options)
  .then(theme => generate(theme, options))
  .then(root => {
    process.stdout.write(root.toString())
  })
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })

function loadTheme(filename, options) {
  return Promise.resolve(
    filename
      ? require(resolve(process.cwd(), filename))
      : {}
  )
}
