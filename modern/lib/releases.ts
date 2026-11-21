export type Release={version:string;date:string;title:string;changes:string[]};
// Add each published release here. The Updates page displays the latest five.
export const releases:Release[]=[
 {version:'0.1.0',date:'2026-11-21',title:'Alpha release',changes:['First alpha release of Holocron Standalone.']},
 {version:'1.0.11',date:'2026-11-21',title:'Premier rules audit',changes:['Updated the Premier card pool for Icons 2027 Edition, kept the Cad Bane and November 2026 suspensions current, and added release-date and rules-set coverage for the Premier-only filter and highlight tag.']},
 {version:'1.0.10',date:'2026-11-21',title:'Options menu and documentation polish',changes:['Refined the Options menu spacing, section hierarchy, and control states for a clearer, more comfortable experience.','Expanded the local setup, deployment, backup, sync, security, and build documentation to match the current standalone app and server configuration.']},
 {version:'1.0.9',date:'2026-11-21',title:'Private account setup',changes:['Gate account creation with a private invite code, reject unlisted origins, allow revoking all device sessions, and confirm before sending a deck to ForceTable.']},
 {version:'1.0.8',date:'2026-11-21',title:'Sign in with a username and password',changes:['Use the same remembered account on every device. Add login credentials to an existing signed-in collection without replacing its cloud data.']},
 {version:'1.0.7',date:'2026-11-21',title:'Keep device sign-ins and local data',changes:['Ask browsers to preserve app storage and recognize equivalent sync-server URLs so an existing device sign-in is not discarded unnecessarily.']},
 {version:'1.0.6',date:'2026-11-20',title:'A clearer card details panel',changes:['Refreshed card information and detail panels with clearer metadata, stats, and rules. Aspect indicators are now thin full-width bars, split evenly for multiple aspects.']},
 {version:'1.0.5',date:'2026-11-20',title:'Choose your home page',changes:['Set the startup and logo home page, keep Sync beside its status in a compact button, and place collection actions side by side on mobile.']},
 {version:'1.0.4',date:'2026-11-20',title:'Refresh site without signing out',changes:['Check for and apply web app updates from Options without clearing saved sign-in or collection data.']},
 {version:'1.0.3',date:'2026-11-20',title:'Quick sync status',changes:['Sync from the app header and see the last successful sync time and whether this device has local changes to sync.']},
 {version:'1.0.2',date:'2026-11-17',title:'Collection review controls',changes:['Review saved decisions from Collection Options. Closing a review or resolving an item clears the panel. The resolver can delete an imported item and all of its copies.']},
 {version:'1.0.1',date:'2026-11-17',title:'A distinct Standalone icon',changes:['The app header, browser tab, and installed app use a new icon. The header and Home Screen label identify this edition as Standalone.']},
 {version:'1.0.0',date:'2026-11-17',title:'Holocron Standalone',changes:['The workspace, card catalog, artwork, and Battle Lab run offline. Use full backups to move your workspace between devices.']},
 {version:'2.9.5',date:'2026-11-16',title:'Balanced logo spacing',changes:['Added comfortable padding around the home logo and centered the icon, title and subtitle on desktop and mobile.']},
 {version:'2.9.4',date:'2026-11-16',title:'High-visibility card highlights',changes:['Doubled outline thickness, added a strong inner halo, and replaced muted highlight colors with vivid colors matched to the legend.']},
 {version:'2.9.3',date:'2026-11-16',title:'Brighter card borders',changes:['Brighter colored card outlines with a subtle halo, plus a stronger Soft glow option.']},
 {version:'2.9.2',date:'2026-11-16',title:'Card highlight layering',changes:['Card outlines and glow rings now render above the artwork, keeping the complete border visible without blocking card controls.']},
 {version:'2.9.1',date:'2026-11-16',title:'See your cards, keep your game plan close',changes:['Choose rarity or custom card highlights by arena, type, cost, Premier eligibility, ownership or saved-deck membership.','Choose outline, corner, ribbon or glow overlays.','Refreshed the card detail screen and brighter, cleaner logo. Version information moved to the bottom of Options.','Added artwork and one-card views to card selection and supporting lists.','Prefilled practice plans for saved decks and fresh matches while preserving your edited notes.']},
 {version:'2.9.0',date:'2026-11-16',title:'Your collection, ready for game night',changes:[
  'Daily catalog checks with a last-good snapshot, visible refresh status, and official news links.',
  'Find saved and starter decks closest to what you own, and owned alternatives for missing cards.',
  'Compare decks and saved versions; review format warnings across your decks.',
  'Collection and deck achievements with set completion progress.',
  'Save match results from the live damage pad and review matchup statistics.',
  'Deck practice notes for openings, resources, and matchups, accessible while playing.',
  'Options → Updates now lists the last five published releases.'
 ]},
 {version:'2.8.1',date:'2026-11-10',title:'Battle Lab presentation',changes:['Improved the Battle Lab screen and card controls.']},
 {version:'2.8.0',date:'2026-11-10',title:'Battle Lab',changes:['Added the separate Battle Lab tool for testing against an AI opponent.']},
 {version:'2.7.20',date:'2026-11-09',title:'Solo table sizing',changes:['Added a cards-across control to the solo table.']},
 {version:'2.7.19',date:'2026-11-09',title:'Responsive lists',changes:['Long list names wrap inside narrow screens without widening the page.']}
];
