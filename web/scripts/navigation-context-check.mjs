import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const routes=readFileSync(new URL('../features/design/routes.ts',import.meta.url),'utf8');
const context=routes.match(/export const contextNavigation=\[([\s\S]*?)\];/)?.[1]??'';
const navigation=readFileSync(new URL('../lib/navigation.ts',import.meta.url),'utf8');
const shell=readFileSync(new URL('../components/app-shell.tsx',import.meta.url),'utf8');

assert.match(context,/\['audit'\]/,'the activity log remains in context navigation');
assert.doesNotMatch(context,/\['orders'\]/,'do not add a redundant single tab to the orders page');
assert.doesNotMatch(context,/imports/,'legacy imports must not appear as a context tab');
assert.match(shell,/context\.length===1&&context\[0\]\[0\]===slug/,'show the remaining activity tab on its own page');
assert.match(navigation,/\['imports','Nhập dữ liệu cũ','imports'\]/,'retain the legacy module/permission definition');
process.stdout.write('Navigation context check passed.\n');
