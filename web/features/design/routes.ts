import source from './reference-nav.json';
export const referenceRoutes:Record<string,{slug:string;module:string}>={
 dashboard:{slug:'',module:'dashboard'},opsdashboard:{slug:'opsdashboard',module:'dashboard'},strategy:{slug:'strategy',module:'strategy'},
 catalog:{slug:'materials',module:'materials'},stores:{slug:'stores',module:'stores'},dishes:{slug:'products',module:'products'},employees:{slug:'employees',module:'employees'},discounts:{slug:'discounts',module:'prices'},
 inventory:{slug:'inventory',module:'inventory'},stockmovements:{slug:'stockmovements',module:'inventory'},stockhistory:{slug:'stockhistory',module:'inventory'},reorder:{slug:'reorder',module:'inventory'},
 recipes:{slug:'recipes',module:'recipes'},batches:{slug:'batches',module:'recipes'},rice:{slug:'rice',module:'recipes'},packaging:{slug:'packaging',module:'recipes'},cost:{slug:'cost',module:'recipes'},
 production:{slug:'production',module:'production'},demand:{slug:'requirements',module:'requirements'},audit:{slug:'counts',module:'counts'},variance:{slug:'variance',module:'reports'},consumption:{slug:'consumption',module:'reports'},
 entry:{slug:'entry',module:'production'},'entry-stock':{slug:'entry-stock',module:'inventory'},'entry-sales':{slug:'sales',module:'sales'},'entry-attendance':{slug:'attendance',module:'attendance'},'entry-production':{slug:'entry-production',module:'production'},'entry-plans':{slug:'targets',module:'targets'},'entry-loans':{slug:'loans',module:'loans'},'entry-debts':{slug:'receivables',module:'receivables'},'entry-cash':{slug:'cash',module:'cash'},'entry-payroll':{slug:'payroll',module:'payroll'},
};
export const referenceNavigation=source;
export function referencePageForSlug(slug:string){return Object.keys(referenceRoutes).find(key=>referenceRoutes[key].slug===slug);}
