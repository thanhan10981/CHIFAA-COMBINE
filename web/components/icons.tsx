import type {SVGProps} from 'react';

// CHIFAA line icons: one grid, rounded strokes, inherited colour. No icon font/library.
const paths:Record<string,string>={
 dashboard:'M3 4h7v7H3z M14 4h7v4h-7z M3 15h7v5H3z M14 12h7v8h-7z',
 chart:'M4 3v17h17 M8 15v-4 M13 15V6 M18 15V9',
 strategy:'M4 20V4h11l-2 4 2 4H4 M8 20H2',
 box:'m3 7 9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M8 5l9 4',
 store:'M4 10v11h16V10 M3 10l2-7h14l2 7 M3 10q3 4 6 0 3 4 6 0 3 4 6 0 M9 21v-7h6v7',
 people:'M15 21v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3 M17 14q4 0 4 4v3 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a3 3 0 0 1 0 6',
 recipe:'M5 3h15v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 M7 3v18 M11 8h5 M11 12h5 M11 16h3',
 inventory:'M3 21V8l9-5 9 5v13 M1 21h22 M7 21V11h10v10 M7 15h10 M7 18h10',
 transfer:'M3 7h17l-4-4 M21 17H4l4 4',
 history:'M4 7a9 9 0 1 1-1 8 M3 3v5h5 M12 7v5l3 2',
 count:'M6 4h3V2h6v2h3v18H6z M9 4v3h6V4 M9 12l1 1 2-2 M14 12h1 M9 17l1 1 2-2 M14 17h1',
 order:'M5 3h14v18l-3-2-4 2-4-2-3 2z M8 8h8 M8 12h8 M8 16h4',
 delivery:'M2 5h12v13H2z M14 10h4l4 4v4h-8 M5 18a2 2 0 1 0 4 0 M16 18a2 2 0 1 0 4 0 M18 10v4h4',
 return:'M8 7H3l4-4 M3 7l4 4 M3 7h12a6 6 0 0 1 0 12H8',
 cash:'M3 7h18v14H3z M3 7V4h15v3 M16 12h5v5h-5z M17 14.5h1',
 bank:'m2 8 10-5 10 5H2 M5 11v7 M10 11v7 M15 11v7 M20 11v7 M2 21h20',
 target:'M12 2a10 10 0 1 0 10 10 M12 6a6 6 0 1 0 6 6 M12 12l8-8 M16 4h4v4',
 settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 shield:'M12 2 3 6v6q0 7 9 10 9-3 9-10V6z m-4 10 3 3 5-6',
 database:'M3 6c0-5 18-5 18 0s-18 5-18 0v12c0 5 18 5 18 0V6 M3 12c0 5 18 5 18 0',
 file:'M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h6',
 upload:'M12 16V3 M7 8l5-5 5 5 M3 16v5h18v-5',
 search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
 plus:'M12 4v16 M4 12h16',
 close:'m6 6 12 12 M18 6 6 18',
 chevron:'m6 9 6 6 6-6',
 arrow:'M5 19 19 5 M6 5h13v13',
 refresh:'M20 9A8 8 0 0 0 6 5L3 8 M3 3v5h5 M4 15a8 8 0 0 0 14 4l3-3 M16 16h5v5',
 menu:'M4 6h16 M4 12h16 M4 18h16',
 check:'m5 12 4 4 10-10',
 success:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 m-5 10 3 3 6-6',
 warning:'m12 3 10 18H2z M12 9v5 M12 17v.1',
 info:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 11v6 M12 7v.1',
 trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
 bag:'M4 7h16l1 14H3z M8 7V6a4 4 0 0 1 8 0v1',
 loader:'M12 3a9 9 0 1 1-9 9',
 logout:'M10 3H4v18h6 M9 12h13 M18 8l4 4-4 4',
 lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
 clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2',
 scale:'M12 3v18 M7 21h10 M4 7h16 M6 7l-4 8h8z M18 7l-4 8h8z',
 asset:'M4 4h16v12H4z M8 20h8 M12 16v4',
};
type Props=SVGProps<SVGSVGElement>&{size?:number;name?:string};
export function Icon({name='box',size=18,...props}:Props){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]??paths.box}/></svg>;}
const make=(name:string)=>function LineIcon(props:Props){return <Icon name={name} {...props}/>;};
export const ChevronDown=make('chevron'),Menu=make('menu'),X=make('close'),ArrowUpRight=make('arrow'),RefreshCw=make('refresh'),Database=make('database'),ShieldCheck=make('shield'),Plus=make('plus'),Search=make('search'),CheckCircle2=make('success'),LoaderCircle=make('loader'),ShoppingBag=make('bag'),Trash2=make('trash');
export function iconMarkup(name:string){return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]??paths.box}"/></svg>`;}
export function replaceDecorativeIcons(markup:string){const glyphs:Record<string,string>={'▤':'recipe','◈':'box','▦':'dashboard','⌕':'search','⧉':'file','✎':'file','⚖':'scale','◫':'box','▥':'chart','⚙':'settings','▣':'box','↩':'return','↻':'refresh','⇄':'transfer','◷':'clock','⇢':'delivery','✦':'info','ⓘ':'info','＋':'plus','↗':'arrow'};return markup.split(/(<[^>]*>)/g).map(part=>part.startsWith('<')?part:part.replace(/[▤◈▦⌕⧉✎⚖◫▥⚙▣↩↻⇄◷⇢✦ⓘ＋↗]/g,glyph=>iconMarkup(glyphs[glyph]))).join('');}
export function navigationIcon(id:string){const names:Record<string,string>={'legacy-catalogs':'box','legacy-warehouse':'inventory','legacy-recipes':'recipe','legacy-production':'settings','legacy-entry':'file','legacy-customers':'people','legacy-system':'shield',dashboard:'dashboard',opsdashboard:'chart',strategy:'strategy',catalog:'box',stores:'store',dishes:'bag',employees:'people',discounts:'scale',inventory:'inventory',stockmovements:'transfer',stockhistory:'history',reorder:'warning',recipes:'recipe',batches:'recipe',rice:'recipe',packaging:'box',cost:'scale',production:'settings',demand:'count',audit:'count',variance:'chart',consumption:'chart',entry:'file','entry-stock':'inventory','entry-sales':'cash','entry-attendance':'clock','entry-production':'settings','entry-plans':'target','entry-loans':'bank','entry-debts':'order','entry-cash':'cash','entry-payroll':'people',kiosk:'store',assets:'asset',orders:'order',admin:'shield',health:'history'};return names[id]??(id.includes('catalog')?'box':id.includes('stock')?'inventory':id.includes('recipe')?'recipe':id.includes('admin')?'shield':id.includes('entry')?'file':'dashboard');}
