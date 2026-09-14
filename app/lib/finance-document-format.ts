export function financeFieldLabel(key:string){return key.replace(/Cents$/,' (ZAR)').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());}
export function financeFieldValue(key:string,value:unknown){return typeof value==='number'&&/Cents$/.test(key)?'R '+(value/100).toFixed(2):typeof value==='boolean'?(value?'Yes':'No'):value===null?'Not recorded':String(value);}
