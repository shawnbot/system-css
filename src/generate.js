const postcss = require('postcss')
const {get} = require('dotmap')
const styledSystem = require('styled-system')

const systemProps = [
  // color
  {name: 'bgColor'},
  {name: 'textColor'},
  // borders
  {name: 'border'},
  {name: 'borderRadius', prefix: 'round', responsive: true},
  // typography
  {name: 'fontSize', prefix: 'f', responsive: true},
  {name: 'fontFamily', prefix: 'font'},
  {name: 'lineHeight', prefix: 'lh', responsive: true},
  {name: 'fontWeight', prefix: 'text'},
  {name: 'textStyle', prefix: 'text'},
  // layout, whitespace
  {name: 'space', responsive: true},
  {name: 'display', prefix: 'd', responsive: true, scale: mapify([
    'block',
    'flex',
    'inline-flex',
    'inline',
    'inline-block',
    'none',
    'table',
    'table-cell'
  ])},
  // etc.
  {name: 'boxShadow'},
].map(prop => ({...prop, func: styledSystem[prop.name]}))

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
    if (!systemProp.func) {
      throw new Error(`No such style prop: "${systemProp.name}"`)
    }
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
    scale: overrideScale,
    responsive = false
  } = systemProp

  const breakpoints = responsive ? breaks : [null]

  const metas = Object.keys(func.propTypes)
    .map(prop => func.propTypes[prop].meta)
    .filter(meta => meta)

  const rules = []
  for (const meta of metas) {
    const {
      prop,
      cssProperty,
      defaultScale = [],
      themeKey
    } = meta

    const scale = overrideScale ||
      get(theme, themeKey) ||
      getDefaultScale(prop, cssProperty) ||
      defaultScale

    for (const brk of breakpoints) {
      const {
        atRule,
        name: breakpoint
      } = brk || {}

      const append = atRule
        ? rule => atRule.append(rule)
        : rule => rules.push(rule)

      for (const [scaleKey, scaleValue] of Object.entries(scale)) {
        const keys = getNestedKeys(scaleKey, scaleValue)
        for (const key of keys) {
          const selector = getSelector({
            prop: prefix || prop,
            breakpoint,
            value: key
          })
          const rule = postcss.rule({selector})
          const style = func({[prop]: key, theme})
          for (let [property, value] of Object.entries(style)) {
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
  }

  return rules
}

function getSelector({prop, breakpoint, value}) {
  const parts = breakpoint
    ? [prop, breakpoint, value]
    : [prop, value]
  const className = parts.join('-').replace(/\./g, '-')
  return `.${className}`
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
  return num(n) && n ? `${n}px` : n
}

function joinKeys(...keys) {
  return keys.join('.')
}

function isObject(d) {
  return d && typeof d === 'object'
}

function getNestedKeys(prefix, values) {
  if (isObject(values)) {
    return Object.keys(values).reduce((keys, k) => {
      const key = joinKeys(prefix, k)
      keys.push(key)
      const value = values[k]
      if (isObject(value)) {
        return keys.concat(
          getNestedKeys(key, value)
        )
      }
      return keys
    }, [])
  } else {
    return [prefix]
  }
}

function mapify(list) {
  return list.reduce((d, v) => Object.assign(d, {[v]: v}), {})
}
