import type {Catalog, Deck} from './model.ts';

export function elapsedBackup(value:string|null, now=Date.now()){
 const time=value?Date.parse(value):NaN;
 if(!Number.isFinite(time))return 'Never';
 const hours=Math.floor(Math.max(0,now-time)/3600000);
 return `${Math.floor(hours/24)} days, ${hours%24} hours ago`;
}

export function affectedDecks(previous:Catalog, next:Catalog, decks:Deck[]){
 const old=new Map(previous.cards.map(card=>[card.id,card]));
 const fresh=new Map(next.cards.map(card=>[card.id,card]));
 const fields=['name','subtitle','type','aspects','traits','keywords','cost','power','hp','arena','text','backText','epic'] as const;
 return decks.flatMap(deck=>{
  const ids=[...new Set([deck.leader,deck.base,...deck.deck.map(row=>row.id),...deck.sideboard.map(row=>row.id)].filter(Boolean))];
  const changed=ids.filter(id=>{
   const before=old.get(id),after=fresh.get(id);
   return !!after&&(!before||fields.some(field=>JSON.stringify(before[field])!==JSON.stringify(after[field])));
  });
  return changed.length?[{deckId:deck.uid,name:deck.name,changed}]:[];
 });
}
