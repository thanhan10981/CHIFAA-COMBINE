import source from './reference-nav.json';
import workspace from './workspace-nav.json';
export const referenceRoutes:Record<string,{slug:string;module:string}>={
 dashboard:{slug:'',module:'dashboard'},opsdashboard:{slug:'opsdashboard',module:'dashboard'},strategy:{slug:'strategy',module:'strategy'},
 catalog:{slug:'materials',module:'materials'},stores:{slug:'stores',module:'stores'},dishes:{slug:'products',module:'products'},employees:{slug:'employees',module:'employees'},discounts:{slug:'discounts',module:'prices'},
 inventory:{slug:'inventory',module:'inventory'},stockmovements:{slug:'stockmovements',module:'inventory'},stockhistory:{slug:'stockhistory',module:'inventory'},reorder:{slug:'reorder',module:'inventory'},
 recipes:{slug:'recipes',module:'recipes'},batches:{slug:'batches',module:'recipes'},rice:{slug:'rice',module:'recipes'},packaging:{slug:'packaging',module:'recipes'},cost:{slug:'cost',module:'recipes'},
 production:{slug:'production',module:'production'},demand:{slug:'requirements',module:'requirements'},audit:{slug:'counts',module:'counts'},variance:{slug:'variance',module:'reports'},consumption:{slug:'consumption',module:'reports'},
 entry:{slug:'entry',module:'production'},'entry-stock':{slug:'entry-stock',module:'inventory'},'entry-sales':{slug:'sales',module:'sales'},'entry-attendance':{slug:'attendance',module:'attendance'},'entry-production':{slug:'entry-production',module:'production'},'entry-plans':{slug:'targets',module:'targets'},'entry-loans':{slug:'loans',module:'loans'},'entry-debts':{slug:'receivables',module:'receivables'},'entry-cash':{slug:'cash',module:'cash'},'entry-payroll':{slug:'payroll',module:'payroll'},
 kiosk:{slug:'kiosk',module:'kiosk'},assets:{slug:'assets',module:'assets'},orders:{slug:'orders',module:'orders'},admin:{slug:'admin',module:'admin'},health:{slug:'audit',module:'audit'},
};
export const referenceNavigation=source;
export const workspaceNavigation=workspace;
export const navigationParents:Record<string,string>={units:'materials',departments:'employees',warehouses:'inventory',deliveries:'orders',returns:'orders',reports:'opsdashboard',imports:'audit',accounts:'cash'};
export const contextNavigation=[
 ['materials','units'],['employees','departments'],['inventory','stockmovements','stockhistory','reorder'],
 ['orders','deliveries','returns'],['opsdashboard','reports'],['audit','imports'],['cash','accounts'],
];
export function referencePageForSlug(slug:string){return [...source.top,...source.groups.flatMap(group=>group.items)].find(item=>referenceRoutes[item.id].slug===slug)?.id;}
