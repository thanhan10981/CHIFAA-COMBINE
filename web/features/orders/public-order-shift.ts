export function publicOrderShift(at=new Date()):'AM'|'PM'{
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',hourCycle:'h23'}).format(at));
 return hour<12?'AM':'PM';
}
