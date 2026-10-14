import fs from 'node:fs/promises'
import vm from 'node:vm'
import { parse as parseComponent } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'

// Execute the actual component handlers with controlled reactive state and stores.
// Parsing keeps the tests independent of formatting or function-body text patterns.
export async function loadComponentFunctions(relative, names, bindings) {
  const file = new URL('../../' + relative, import.meta.url)
  const { descriptor } = parseComponent(await fs.readFile(file, 'utf8'))
  const script = descriptor.scriptSetup.content
  const ast = parse(script, { sourceType: 'module' })
  const declarations = names.map(name => {
    const declaration = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
    if (!declaration) throw new Error(`Missing handler ${name} in ${relative}`)
    return script.slice(declaration.start, declaration.end)
  })
  const context = vm.createContext({ ...bindings })
  return vm.runInContext(declarations.join('\n') + '\n({' + names.join(',') + '})', context)
}
