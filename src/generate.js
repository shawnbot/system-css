const postcss = require('postcss')
const {get} = require('dotmap')
const styled = require('styled-system')

const systemProps = [
  {name: 'space'},
  {name: 'fontSize', prefix: 'f'},
  {name: 'color', responsive: false}
].map(prop => ({...prop, func: styled[prop.name]}))

// see: styled-system/src/#TODO
const defaultBreakpoints = [40, 52, 64,].map(n => n + 'em')

// these are needed because styled-system-compatible themes
// don't provide names for the breakpoint lengths
const defaultBreakpointNames = ['sm', 'md', 'lg', 'xl', 'xxl', 'xxxl']

const defaultTheme = {
  // see: styled-system/src/space.js#L54
  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],
  breakpoints: defaultBreakpoints,
  breakpointNames: defaultBreakpointNames
}

const spacePattern = /^[mp][trblxy]?$/

module.exports = function generateCSS(theme = defaultTheme) {
  const {
    breakpoints: breakpointValues = [],
    breakpointNames = defaultBreakpointNames
  } = theme

  const breakpoints = breakpointValues.map((value, i) => {
    return {
      name: breakpointNames[i],
      value,
      atRule: postcss.atRule({
        name: 'media',
        params: `screen and (min-width: ${value})`
      })
    }
  })

  breakpoints.unshift(null)
  // console.warn('breakpoints:', breakpoints)

  const root = postcss.root()

  for (const systemProp of systemProps) {
    const rules = generateRulesForStyle(systemProp, theme, breakpoints)
    if (rules.length === 0) {
      console.warn('no rules for prop: %s', systemProp.name)
      continue
    }
    for (const rule of rules) {
      root.append(rule)
    }
  }

  for (const {atRule} of breakpoints.slice(1)) {
    root.append(atRule)
  }

  return root
}

function generateRulesForStyle(systemProp, theme, breaks) {
  const {
    func,
    prefix,
    responsive = true
  } = systemProp

  const breakpoints = responsive ? breaks : [null]

  const metas = Object.keys(func.propTypes)
    .map(prop => func.propTypes[prop].meta)

  const rules = []
  for (const meta of metas) {
    const {
      prop,
      cssProperty,
      defaultScale = [],
      themeKey
    } = meta

    const scale = get(theme, themeKey) || getDefaultScale(prop, cssProperty) || defaultScale

    for (const brk of breakpoints) {
      const {
        atRule,
        name: breakpoint
      } = brk || {}

      const append = atRule
        ? rule => atRule.append(rule)
        : rule => rules.push(rule)

      for (const [key, scaleValue] of Object.entries(scale)) {
        if (scaleValue && typeof scaleValue === 'object') {
          continue
        }
        const selector = getSelector({
          prop: prefix || prop,
          breakpoint,
          key,
          value: scaleValue
        })
        const rule = postcss.rule({selector})
        const style = func({[prop]: key})
        for (const [property, value] of Object.entries(style)) {
          // skip over nested scales
          if (value && typeof value === 'object') {
            continue
          }
          const cssValue = px(value)
          const decl = postcss.decl({
            prop: hyphenate(property),
            value: cssValue,
            important: true
          })
          rule.append(decl)
        }
        append(rule)
      }
    }
  }

  return rules
}

function getSelector({prop, breakpoint, key, value}) {
  const parts = breakpoint
    ? [prop, breakpoint, key]
    : [prop, key]
  return `.${parts.join('-')}`
}

function getDefaultScale(prop, cssProperty) {
  // TODO
}

function hyphenate(property) {
  return property.replace(/([a-z])([A-Z])/g, (_, a, b) => {
    return [a, b.toLowerCase()].join('-')
  })
}

function num(n) {
  return typeof n === 'number' && !isNaN(n)
}

function px(n) {
  return num(n) ? `${n}px` : n
}
