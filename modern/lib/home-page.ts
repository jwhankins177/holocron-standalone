export const homePageOptions=[
 {value:'catalog',label:'Card catalog'},
 {value:'collection',label:'My collection'},
 {value:'decks',label:'My decks'},
 {value:'lists',label:'Lists'},
 {value:'tools',label:'Tools'},
 {value:'guides',label:'Guides'}
] as const;

export type HomePage=typeof homePageOptions[number]['value'];

export function normalizeHomePage(value:unknown):HomePage{
 return homePageOptions.find(option=>option.value===value)?.value??'catalog';
}
