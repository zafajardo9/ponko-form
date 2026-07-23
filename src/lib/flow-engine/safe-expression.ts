type LiteralValue = number | string | boolean

type ExpressionNode =
  | { type: 'literal'; value: LiteralValue }
  | { type: 'identifier'; name: string }
  | { type: 'unary'; operator: '+' | '-' | '!' | 'not'; argument: ExpressionNode }
  | {
      type: 'binary'
      operator: string
      left: ExpressionNode
      right: ExpressionNode
    }
  | {
      type: 'conditional'
      condition: ExpressionNode
      whenTrue: ExpressionNode
      whenFalse: ExpressionNode
    }
  | { type: 'call'; name: string; arguments: ExpressionNode[] }

type TokenKind = 'number' | 'string' | 'identifier' | 'operator' | 'punctuation' | 'eof'
type Token = { kind: TokenKind; value: string; position: number }

const MAX_EXPRESSION_LENGTH = 10_000
const MAX_TOKENS = 1_000
const MAX_PARSE_DEPTH = 100
const MAX_AST_NODES = 500

class Tokenizer {
  private index = 0
  private tokenCount = 0

  constructor(private readonly source: string) {
    if (source.length > MAX_EXPRESSION_LENGTH) {
      throw new Error(`Expression exceeds ${MAX_EXPRESSION_LENGTH} characters`)
    }
  }

  next(): Token {
    while (this.index < this.source.length && /\s/.test(this.source[this.index])) {
      this.index += 1
    }
    if (this.index >= this.source.length) {
      return { kind: 'eof', value: '', position: this.index }
    }
    this.tokenCount += 1
    if (this.tokenCount > MAX_TOKENS) throw new Error('Expression contains too many tokens')

    const position = this.index
    const character = this.source[this.index]
    if (/[0-9.]/.test(character)) return this.numberToken()
    if (character === '"' || character === "'") return this.stringToken()
    if (/[A-Za-z_]/.test(character)) return this.identifierToken()

    const three = this.source.slice(this.index, this.index + 3)
    if (three === '===' || three === '!==') {
      throw new Error(`Unsupported operator "${three}" at position ${position}`)
    }
    const two = this.source.slice(this.index, this.index + 2)
    if (['>=', '<=', '==', '!=', '&&', '||', '**'].includes(two)) {
      this.index += 2
      return { kind: 'operator', value: two, position }
    }
    if ('+-*/%^><!'.includes(character)) {
      this.index += 1
      return { kind: 'operator', value: character, position }
    }
    if ('(),?:'.includes(character)) {
      this.index += 1
      return { kind: 'punctuation', value: character, position }
    }
    throw new Error(`Unexpected character "${character}" at position ${position}`)
  }

  private numberToken(): Token {
    const position = this.index
    const match = this.source.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)
    if (!match) throw new Error(`Invalid number at position ${position}`)
    this.index += match[0].length
    return { kind: 'number', value: match[0], position }
  }

  private stringToken(): Token {
    const position = this.index
    const quote = this.source[this.index]
    this.index += 1
    let value = ''
    while (this.index < this.source.length) {
      const character = this.source[this.index]
      this.index += 1
      if (character === quote) return { kind: 'string', value, position }
      if (character !== '\\') {
        value += character
        continue
      }
      if (this.index >= this.source.length) break
      const escaped = this.source[this.index]
      this.index += 1
      value += ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[escaped] ?? escaped
    }
    throw new Error(`Unterminated string at position ${position}`)
  }

  private identifierToken(): Token {
    const position = this.index
    const match = this.source.slice(this.index).match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (!match) throw new Error(`Invalid identifier at position ${position}`)
    this.index += match[0].length
    return { kind: 'identifier', value: match[0], position }
  }
}

class Parser {
  private current: Token
  private depth = 0
  private nodeCount = 0

  constructor(private readonly tokenizer: Tokenizer) {
    this.current = tokenizer.next()
  }

  parse(): ExpressionNode {
    const expression = this.parseConditional()
    if (this.current.kind !== 'eof') {
      throw new Error(`Unexpected token "${this.current.value}" at position ${this.current.position}`)
    }
    return expression
  }

  private node<T extends ExpressionNode>(node: T): T {
    this.nodeCount += 1
    if (this.nodeCount > MAX_AST_NODES) throw new Error('Expression is too complex')
    return node
  }

  private nested<T>(callback: () => T): T {
    this.depth += 1
    if (this.depth > MAX_PARSE_DEPTH) throw new Error('Expression nesting is too deep')
    try {
      return callback()
    } finally {
      this.depth -= 1
    }
  }

  private advance() {
    const previous = this.current
    this.current = this.tokenizer.next()
    return previous
  }

  private match(value: string) {
    if (this.current.value !== value) return false
    this.advance()
    return true
  }

  private expect(value: string) {
    if (!this.match(value)) {
      throw new Error(`Expected "${value}" at position ${this.current.position}`)
    }
  }

  private parseConditional(): ExpressionNode {
    const condition = this.parseOr()
    if (!this.match('?')) return condition
    return this.nested(() => {
      const whenTrue = this.parseConditional()
      this.expect(':')
      const whenFalse = this.parseConditional()
      return this.node({ type: 'conditional', condition, whenTrue, whenFalse })
    })
  }

  private parseOr(): ExpressionNode {
    let left = this.parseAnd()
    while (this.current.value === 'or' || this.current.value === '||') {
      const operator = this.advance().value
      left = this.node({ type: 'binary', operator, left, right: this.parseAnd() })
    }
    return left
  }

  private parseAnd(): ExpressionNode {
    let left = this.parseEquality()
    while (this.current.value === 'and' || this.current.value === '&&') {
      const operator = this.advance().value
      left = this.node({ type: 'binary', operator, left, right: this.parseEquality() })
    }
    return left
  }

  private parseEquality(): ExpressionNode {
    let left = this.parseComparison()
    while (['==', '!='].includes(this.current.value)) {
      const operator = this.advance().value
      left = this.node({ type: 'binary', operator, left, right: this.parseComparison() })
    }
    return left
  }

  private parseComparison(): ExpressionNode {
    let left = this.parseAdditive()
    while (['>', '>=', '<', '<='].includes(this.current.value)) {
      const operator = this.advance().value
      left = this.node({ type: 'binary', operator, left, right: this.parseAdditive() })
    }
    return left
  }

  private parseAdditive(): ExpressionNode {
    let left = this.parseMultiplicative()
    while (this.current.value === '+' || this.current.value === '-') {
      const operator = this.advance().value
      left = this.node({ type: 'binary', operator, left, right: this.parseMultiplicative() })
    }
    return left
  }

  private parseMultiplicative(): ExpressionNode {
    let left = this.parseUnary()
    while (['*', '/', '%'].includes(this.current.value)) {
      const operator = this.advance().value
      left = this.node({ type: 'binary', operator, left, right: this.parseUnary() })
    }
    return left
  }

  private parseUnary(): ExpressionNode {
    if (['+', '-', '!', 'not'].includes(this.current.value)) {
      const operator = this.advance().value as '+' | '-' | '!' | 'not'
      return this.nested(() => this.node({
        type: 'unary',
        operator,
        argument: this.parseUnary(),
      }))
    }
    return this.parsePower()
  }

  private parsePower(): ExpressionNode {
    const left = this.parsePrimary()
    if (this.current.value !== '^' && this.current.value !== '**') return left
    const operator = this.advance().value
    return this.nested(() => this.node({
      type: 'binary',
      operator,
      left,
      right: this.parseUnary(),
    }))
  }

  private parsePrimary(): ExpressionNode {
    if (this.match('(')) {
      return this.nested(() => {
        const expression = this.parseConditional()
        this.expect(')')
        return expression
      })
    }
    if (this.current.kind === 'number') {
      const token = this.advance()
      const value = Number(token.value)
      if (!Number.isFinite(value)) throw new Error(`Invalid number at position ${token.position}`)
      return this.node({ type: 'literal', value })
    }
    if (this.current.kind === 'string') {
      return this.node({ type: 'literal', value: this.advance().value })
    }
    if (this.current.kind !== 'identifier') {
      throw new Error(`Expected a value at position ${this.current.position}`)
    }

    const name = this.advance().value
    if (name === 'true' || name === 'false') {
      return this.node({ type: 'literal', value: name === 'true' })
    }
    if (!this.match('(')) return this.node({ type: 'identifier', name })

    return this.nested(() => {
      const arguments_: ExpressionNode[] = []
      if (!this.match(')')) {
        do {
          arguments_.push(this.parseConditional())
        } while (this.match(','))
        this.expect(')')
      }
      return this.node({ type: 'call', name, arguments: arguments_ })
    })
  }
}

function finiteNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number`)
  }
  return value
}

function numericArguments(values: unknown[], name: string) {
  const flattened = values.length === 1 && Array.isArray(values[0]) ? values[0] : values
  return flattened.map((value) => finiteNumber(value, `${name} argument`))
}

const SAFE_FUNCTIONS: Record<string, (...arguments_: unknown[]) => unknown> = {
  if: (condition, whenTrue, whenFalse) => (condition ? whenTrue : whenFalse),
  contains: (value, expected) => Array.isArray(value)
    ? value.some((item) => String(item) === String(expected))
    : String(value ?? '').includes(String(expected ?? '')),
  round: (value, decimals = 0) => {
    const number = finiteNumber(value, 'round value')
    const places = finiteNumber(decimals, 'round decimals')
    if (!Number.isInteger(places) || places < -15 || places > 15) {
      throw new Error('round decimals must be an integer between -15 and 15')
    }
    const factor = 10 ** places
    return Math.round((number + Number.EPSILON) * factor) / factor
  },
  sum: (...values) => numericArguments(values, 'sum').reduce((total, value) => total + value, 0),
  min: (...values) => {
    const numbers = numericArguments(values, 'min')
    if (numbers.length === 0) throw new Error('min requires at least one argument')
    return Math.min(...numbers)
  },
  max: (...values) => {
    const numbers = numericArguments(values, 'max')
    if (numbers.length === 0) throw new Error('max requires at least one argument')
    return Math.max(...numbers)
  },
  abs: (value) => Math.abs(finiteNumber(value, 'abs argument')),
  equalText: (left, right) => String(left ?? '') === String(right ?? ''),
}

export const RESERVED_EXPRESSION_NAMES = new Set([
  ...Object.keys(SAFE_FUNCTIONS),
  'add',
  'subtract',
  'multiply',
  'divide',
  'mod',
  'pow',
  'unaryMinus',
  'unaryPlus',
  'larger',
  'largerEq',
  'smaller',
  'smallerEq',
  'equal',
  'unequal',
  'and',
  'or',
  'not',
])

export function parseSafeExpression(expression: string): ExpressionNode {
  if (!expression.trim()) throw new Error('Expression is required')
  return new Parser(new Tokenizer(expression)).parse()
}

export function evaluateSafeExpression(
  expression: ExpressionNode,
  variables: Record<string, unknown>,
  customFunctions: Record<string, (...arguments_: unknown[]) => unknown> = {},
): unknown {
  const functions = { ...SAFE_FUNCTIONS, ...customFunctions }

  function evaluate(node: ExpressionNode): unknown {
    switch (node.type) {
      case 'literal':
        return node.value
      case 'identifier':
        if (!Object.hasOwn(variables, node.name)) throw new Error(`Unknown identifier: "${node.name}"`)
        return variables[node.name]
      case 'unary': {
        const value = evaluate(node.argument)
        if (node.operator === '!' || node.operator === 'not') return !value
        const numeric = finiteNumber(value, 'Unary operand')
        return node.operator === '-' ? -numeric : numeric
      }
      case 'conditional':
        return evaluate(node.condition) ? evaluate(node.whenTrue) : evaluate(node.whenFalse)
      case 'call': {
        if (!Object.hasOwn(functions, node.name)) throw new Error(`Unknown function: "${node.name}"`)
        return functions[node.name](...node.arguments.map(evaluate))
      }
      case 'binary': {
        if (node.operator === 'and' || node.operator === '&&') {
          return Boolean(evaluate(node.left)) && Boolean(evaluate(node.right))
        }
        if (node.operator === 'or' || node.operator === '||') {
          return Boolean(evaluate(node.left)) || Boolean(evaluate(node.right))
        }
        const left = evaluate(node.left)
        const right = evaluate(node.right)
        if (node.operator === '==') {
          if (typeof left === 'string' || typeof right === 'string') return false
          return left === right
        }
        if (node.operator === '!=') {
          if (typeof left === 'string' || typeof right === 'string') return true
          return left !== right
        }
        const leftNumber = finiteNumber(left, 'Left operand')
        const rightNumber = finiteNumber(right, 'Right operand')
        switch (node.operator) {
          case '+': return leftNumber + rightNumber
          case '-': return leftNumber - rightNumber
          case '*': return leftNumber * rightNumber
          case '/': return leftNumber / rightNumber
          case '%': return leftNumber % rightNumber
          case '^':
          case '**': return leftNumber ** rightNumber
          case '>': return leftNumber > rightNumber
          case '>=': return leftNumber >= rightNumber
          case '<': return leftNumber < rightNumber
          case '<=': return leftNumber <= rightNumber
          default: throw new Error(`Unsupported operator: "${node.operator}"`)
        }
      }
    }
  }

  return evaluate(expression)
}
