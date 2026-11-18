export function periodRange(anchor:string,period:string){
 const d=new Date(anchor+'T00:00:00Z');
 if(!anchor||!Number.isFinite(d.getTime()))return {from:'',to:''};
 const end=new Date(d),start=new Date(d);
 if(period==='week'){start.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);end.setTime(start.getTime());end.setUTCDate(start.getUTCDate()+6);}
 if(period==='rolling7')start.setUTCDate(d.getUTCDate()-6);
 if(period==='month'){start.setUTCDate(1);end.setUTCMonth(d.getUTCMonth()+1,0);}
 if(period==='quarter'){start.setUTCMonth(Math.floor(d.getUTCMonth()/3)*3,1);end.setUTCMonth(Math.floor(d.getUTCMonth()/3)*3+3,0);}
 return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};
}
