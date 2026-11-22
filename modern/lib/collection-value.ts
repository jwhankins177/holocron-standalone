import type {Owned} from './model';

export type ValuePrices={normal:number|null;foil:number|null};
export function collectionValue(collection:Owned[],values:Readonly<Record<string,ValuePrices>>){
 let cents=0,missing=0;
 for(const row of collection){
  const price=values[row.id]?.[row.foil?'foil':'normal'];
  if(price==null)missing+=row.count;
  else cents+=Math.round(price*100)*row.count;
 }
 return {amount:cents/100,missing};
}
