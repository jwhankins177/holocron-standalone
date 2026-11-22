'use client';
import {collectionAchievements} from './lib/insights';
import HighlightOptions,{HighlightProvider,useCardHighlight,HighlightBadge} from './HighlightOptions';
import {highlightSettings} from './lib/highlights';
import {generatedPractice} from './lib/practice-plan';
import {BuildableDecks,ReplacementsPanel,DeckCompare,LegalityAlerts,Achievements} from './Insights';
import {MatchHistory,RecordMatch} from './PlayRecords';
import ReleaseUpdates from './ReleaseUpdates';
import {saveMatch,type PracticeNotes,type MatchRecord} from './lib/play-records';
import OfflineInstall from './OfflineInstall';
import StarterDeckPicker from './components/starter-deck-picker';
import {addStarterDeck,type StarterDeck} from './lib/starter-decks';
import GuidedDeck from './GuidedDeck';
import DeckAssembly from './DeckAssembly';
import GameTable from './GameTable';
import {AcrossDeckPanel,FormatPanel,VersionsPanel} from './DeckTools';
import {changeLabel,readHistory,writeHistory} from './lib/change-history';
import type {ChangePoint} from './lib/change-history';
import CollectionResolver from './components/collection-resolver';
import {APP_VERSION} from './lib/version';
import {homePageOptions,normalizeHomePage,type HomePage} from './lib/home-page';
import Modal from './components/modal';
import Guides from './components/guides';
import FavoriteButton from './components/favorite-button';
import ThemePicker,{normalizeTheme} from './ThemePicker';
import type {HolocronTheme} from './lib/model';
import {premierCards} from './lib/premier';
import {cardKindOptions,compareCards,orderedAspects,defaultQuickFilters,defaultSort,emptyFilters,kindsFromLegacyType,matchesCardKinds,sortLabels,sortRule} from './lib/card-display';
import type {CardFilters,QuickFilter,SortRule} from './lib/card-display';
import {nativeCall} from './lib/browser-actions';
import {loadLocal,saveLocal,WorkspaceConflict} from './lib/local-store';
import {cacheCatalog,readCachedCatalog} from './lib/catalog-store';
import {CardValueLabel,CardValueProvider,useCardValues,ValueSummary} from './lib/card-values';
import {explainSyncError,getRemoteCatalog,getRemoteWorkspace,getSyncAccount,loginAccount,logoutAccount,logoutAllAccounts,normalizeSyncUrl,putRemoteWorkspace,refreshRemoteCatalog,registerAccount,setSyncAccountCredentials,validateCatalog} from './lib/sync-api';
import {readSyncSession} from './lib/sync-session';
import {affectedDecks,elapsedBackup} from './lib/workspace-extras';
import {validatePlayRecords} from './lib/play-records';
import {syncSnapshot} from './lib/workspace-sync';
import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import {Box,Layers,Library,Search,Upload,Download,Plus,ArrowUpRight,Grid2X2,List,SlidersHorizontal,X,ChevronLeft,ChevronRight,Check,HardDrive,RotateCw,Trash2,Copy,BarChart3,Play,Bookmark,Minus,CheckCircle2,AlertCircle,ArrowDownUp,BookOpen,Shield,Package,Settings2,Wrench} from 'lucide-react';
import {Card,Catalog,Deck,Owned,Workspace,emptyWorkspace,parseCollection,mergeCollection,exportCollection,exportCardList,exportMassEntry,parseDeck,deckExport,forceTableDeckUrl,aspectPenalty,probability,deckWarnings,validateBackup,makeId,createBackup,toggleFavorite,matchesAspects,deckMembership,CollectionResolution,effectiveCollection,unresolvedCollection,setCollectionResolution,parseCollectionImport,applyCollectionImport,adjustEffectiveOwned} from './lib/model';
const colors:Record<string,string>={Vigilance:'#497db8',Command:'#44876c',Aggression:'#c95d51',Cunning:'#c29a39',Heroism:'#d9d7c9',Villainy:'#454a4c'};
const aspects=Object.keys(colors);
const siteVersion=`v${APP_VERSION} · standalone`;
const HOME_PAGE_KEY='holocron-home-page';
function readHomePage():HomePage{
 try{return normalizeHomePage(localStorage.getItem(HOME_PAGE_KEY))}catch{return 'catalog'}
}
function readStoredSyncSession(){
 try{
  if(localStorage.getItem('holocron-sync-email')){
   localStorage.removeItem('holocron-sync-token');localStorage.removeItem('holocron-sync-email');localStorage.removeItem('holocron-sync-user-id');localStorage.removeItem('holocron-sync-auth-url');
   return null;
  }
  return readSyncSession(localStorage,normalizeSyncUrl);
 }catch{return null}
}
function readStoredSyncUsername(){
 try{return localStorage.getItem('holocron-sync-username')||''}catch{return ''}
}
function storeSyncUsername(username:string){
 try{localStorage.setItem('holocron-sync-username',username)}catch{}
}
type SyncStatusRecord={lastSyncedAt:string;localRevision:number;remoteRevision:number};
function readSyncStatus(base:string,userId:number):SyncStatusRecord|null{
 if(!userId)return null;
 try{
  const value=JSON.parse(localStorage.getItem(`holocron-sync-status:${normalizeSyncUrl(base)}:${userId}`)||'null');
  if(!value||typeof value.lastSyncedAt!=='string'||!Number.isSafeInteger(value.localRevision)||!Number.isSafeInteger(value.remoteRevision)||!Number.isFinite(Date.parse(value.lastSyncedAt)))return null;
  return value;
 }catch{return null}
}
function defaultSyncServer(){
 return ['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.hostname.endsWith('.ts.net')?'':location.origin;
}
function aspectGroup(card:Card){
 return orderedAspects(card.aspects).join(' / ')||'Neutral';
}
const count=(a:{count:number}[])=>a.reduce((s,x)=>s+x.count,0);
const label=(c?:Card)=>c?c.name+(c.subtitle?' · '+c.subtitle:''):'Choose a card';
async function download(name:string,data:string){
 try{return await nativeCall('export',{name,data})}
 catch(error){alert(error instanceof Error ? error.message : 'Unable to save the file');return false}
}
function Dots({values}:{values:string[]}){const aspects=orderedAspects(values);return <span className="dots" role="img" aria-label={aspects.length?'Aspects: '+aspects.join(', '):'No aspects'}>{aspects.map((a,i)=><span key={a+i} title={a} style={{background:colors[a]||'#aaa'}}/>)}</span>}
function Art({card,back=false,onClick}:{card:Card;back?:boolean;onClick?:()=>void}){const {highlight,style:highlightStyle}=useCardHighlight(card);const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[card.id,back]);return <div data-highlight={highlight?highlightStyle:undefined} style={highlight?{'--highlight-color':highlight.color} as React.CSSProperties:undefined} title={highlight?.label} data-rarity={card.rarity} className={'art '+(['Leader','Base'].includes(card.type)&&!back?'horizontal':'')} onClick={onClick}><HighlightBadge highlight={highlight}/>{!failed?<span className="art-face"><img loading="lazy" src={back&&card.back?card.back:card.image} alt={label(card)+(back?' — reverse':'')} onError={()=>setFailed(true)}/></span>:<div className="art-fallback"><Box size={28}/><strong>{card.name}</strong><p>{card.text}</p><small>Artwork unavailable · {card.id}</small></div>}</div>}
function CardKindPicker({value,onChange}:{value:string[];onChange:(next:string[])=>void}){
 const selected=cardKindOptions.filter(option=>value.includes(option.value));
 const summary=selected.length===0?'All':selected.length===1?selected[0].label:`${selected.length} selected`;
 return <details className="aspect-picker card-kind-picker"><summary>Card kind · {summary}</summary><div role="group" aria-label="Card kinds">{cardKindOptions.map(option=><label key={option.value}><input type="checkbox" checked={value.includes(option.value)} onChange={()=>onChange(value.includes(option.value)?value.filter(kind=>kind!==option.value):[...value,option.value])}/>{option.label}</label>)}<button type="button" onClick={()=>onChange([])}>All card kinds</button></div></details>;
}
const workspaceKey = 'standalone';
export default function Home(){
 const [homePage,setHomePage]=useState<HomePage>(readHomePage);
 const [catalog,setCatalog]=useState<Catalog|null>(null),[workspace,setWorkspace]=useState<Workspace>(emptyWorkspace),[loaded,setLoaded]=useState(false),[status,setStatus]=useState('Loading local workspace'),[error,setError]=useState(''),[favoriteView,setFavoriteView]=useState('cards'),[tab,setTab]=useState<string>(readHomePage),[deckId,setDeckId]=useState(''),[deckView,setDeckView]=useState('cards'),[q,setQ]=useState(''),[aspect,setAspect]=useState<string[]>([]),[aspectMode,setAspectMode]=useState('any'),[listId,setListId]=useState(''),[listCard,setListCard]=useState<Card|null>(null),[listName,setListName]=useState(''),[theme,setTheme]=useState<HolocronTheme>(()=>{try{return normalizeTheme(localStorage.getItem('holocron-theme'))}catch{return 'dark'}}),[kinds,setKinds]=useState<string[]>([]),[set,setSet]=useState(''),[keyword,setKeyword]=useState(''),[trait,setTrait]=useState(''),[rarity,setRarity]=useState(''),[finish,setFinish]=useState(''),[variant,setVariant]=useState(''),[arena,setArena]=useState(''),[ability,setAbility]=useState(''),[artist,setArtist]=useState(''),[maxCost,setMaxCost]=useState(''),[minPower,setMinPower]=useState(''),[minHp,setMinHp]=useState(''),[onlyOwned,setOnlyOwned]=useState(false),[onlyUnowned,setOnlyUnowned]=useState(false),[premierOnly,setPremierOnly]=useState(false),[allPrintings,setAllPrintings]=useState(false),[view,setView]=useState('grid'),[size,setSize]=useState(240),[advanced,setAdvanced]=useState(false),[limit,setLimit]=useState(48),[detail,setDetail]=useState<Card|null>(null),[flipped,setFlipped]=useState(false),[tileBacks,setTileBacks]=useState<Record<string,boolean>>({}),[modal,setModal]=useState(''),[importText,setImportText]=useState(''),[importType,setImportType]=useState('collection'),[importMode,setImportMode]=useState('add'),[preview,setPreview]=useState<any>(null),[notice,setNotice]=useState(''),[editName,setEditName]=useState(''),[draws,setDraws]=useState(6),[copies,setCopies]=useState(3),[section,setSection]=useState<'deck'|'sideboard'>('deck');
 const [starterPickerOpen,setStarterPickerOpen]=useState(false);
 const [starterInitialId,setStarterInitialId]=useState('');
 const [syncOpen,setSyncOpen]=useState(false);
 const [syncUrl,setSyncUrl]=useState(()=>{try{return localStorage.getItem('holocron-sync-url')||defaultSyncServer()}catch{return defaultSyncServer()}});
 const [syncUsername,setSyncUsername]=useState(readStoredSyncUsername);
 const [syncPassword,setSyncPassword]=useState('');
 const [syncPasswordConfirm,setSyncPasswordConfirm]=useState('');
 const [syncInviteCode,setSyncInviteCode]=useState('');
 const [syncAuthMode,setSyncAuthMode]=useState<'login'|'register'>('login');
 const [syncAccountUsername,setSyncAccountUsername]=useState<string|null>(null);
 const [syncAccountLoaded,setSyncAccountLoaded]=useState(false);
 const [syncToken,setSyncToken]=useState(()=>readStoredSyncSession()?.token||'');
 const [syncUserId,setSyncUserId]=useState(()=>readStoredSyncSession()?.userId||0);
 const [syncStatus,setSyncStatus]=useState<SyncStatusRecord|null>(()=>readSyncStatus(syncUrl,syncUserId));
 const [syncBusy,setSyncBusy]=useState(false);
 const [syncMessage,setSyncMessage]=useState('');
 const [syncFailed,setSyncFailed]=useState(false);
 const [remoteConflict,setRemoteConflict]=useState<{revision:number;updatedAt:string;data:Workspace}|null>(null);
 const [autoSync,setAutoSync]=useState(()=>{try{return localStorage.getItem('holocron-auto-sync')==='true'}catch{return false}});
 const [autoRetry,setAutoRetry]=useState(0);
 const [lastBackup,setLastBackup]=useState(()=>{try{return localStorage.getItem('holocron-last-backup')}catch{return null}});
 const [backupClock,setBackupClock]=useState(Date.now());
 const [catalogChanges,setCatalogChanges]=useState<{deckId:string;name:string;changed:string[]}[]>([]);
 const catalogComparison=useRef<{before:Catalog;after:Catalog}|null>(null);
 const [forceMatch,setForceMatch]=useState<MatchRecord|null>(null);
 const [forceMatchOpen,setForceMatchOpen]=useState(false);
 const forceAway=useRef(false);
 const forceMatchPending=useRef(false);
 const syncInFlight=useRef(false);
 const resolvingSync=useRef(false);
 const autoAttempt=useRef('');
 useEffect(()=>{const timer=window.setInterval(()=>setBackupClock(Date.now()),60000);return()=>window.clearInterval(timer)},[]);
 useEffect(()=>{const online=()=>{autoAttempt.current='';setAutoRetry(value=>value+1)};window.addEventListener('online',online);return()=>window.removeEventListener('online',online)},[]);
 useEffect(()=>{if(loaded&&catalogComparison.current){const {before,after}=catalogComparison.current;setCatalogChanges(affectedDecks(before,after,current.current.decks));catalogComparison.current=null}},[loaded,catalog]);
 useEffect(()=>{
  try{
   const raw=sessionStorage.getItem('holocron-force-match');
   if(raw){const match=validatePlayRecords({practice:[],matches:[JSON.parse(raw)]}).matches[0];forceMatchPending.current=true;setForceMatch(match);setForceMatchOpen(true)}
  }catch{setError('The pending ForceTable result could not be restored.')}
 },[]);
 useEffect(()=>{
  const visibility=()=>{if(!forceMatchPending.current)return;if(document.visibilityState==='hidden')forceAway.current=true;else if(forceAway.current){forceAway.current=false;setForceMatchOpen(true)}};
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('focus',visibility);
  return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',visibility)};
 },[]);
 useEffect(()=>{const storage=navigator.storage;if(storage?.persist)void storage.persist().catch(()=>false)},[]);
 useEffect(()=>{
  if(!syncOpen||!syncToken){setSyncAccountLoaded(false);return}
  let active=true;
  setSyncAccountLoaded(false);
  void getSyncAccount(normalizeSyncUrl(syncUrl),syncToken).then(account=>{
   if(active){
    setSyncAccountUsername(account.username);setSyncAccountLoaded(true);
    if(account.username){setSyncUsername(account.username);storeSyncUsername(account.username)}
   }
  }).catch(error=>{
   if(!active)return;
   setSyncAccountLoaded(true);
   if(discardExpiredSyncSession(error))setSyncMessage('This sign-in expired. Sign in again with your username and password.');
   else setSyncMessage(error instanceof Error?error.message:'Unable to check this account.');
  });
  return()=>{active=false};
 },[syncOpen,syncToken,syncUrl]);
 useEffect(()=>{if(!loaded||!catalog)return;const earned=collectionAchievements(workspace,catalog).filter(a=>a.earned&&!workspace.achievementUnlocks?.[a.id]);if(earned.length)update({...current.current,achievementUnlocks:{...current.current.achievementUnlocks,...Object.fromEntries(earned.map(a=>[a.id,new Date().toISOString()]))}},false,false)},[loaded,catalog,workspace.collection,workspace.resolutions,workspace.decks,workspace.achievementUnlocks]);
 function importStarter(starter:StarterDeck){try{const result=addStarterDeck(current.current,starter);if(!result.existing&&!update(result.workspace))return 'The deck could not be saved. Please resolve the workspace save error and try again.';setStarterPickerOpen(false);setFolderFilter('');setSection('deck');nav('deck');setDeckId(result.deck.uid);setDeckView('cards');setView('grid');resetFilters();setNotice(result.existing?'Opened your existing deck.':'Starter added to My decks. Collection quantities are unchanged.');return undefined}catch(error){return error instanceof Error?error.message:'Unable to import starter deck'}}
 const [collectionCard,setCollectionCard]=useState<Card|null>(null);
 const [toolsDeckId,setToolsDeckId]=useState(()=>{try{return localStorage.getItem('holocron-tools-deck')||''}catch{return ''}});
 const [toolsMode,setToolsMode]=useState<'practice'|'live'>(()=>{try{return localStorage.getItem('holocron-tools-mode')==='live'?'live':'practice'}catch{return 'practice'}});
 const [toolsPanel,setToolsPanel]=useState('game');
 const openSavedDeck=(deck:Deck)=>{nav('deck');setDeckId(deck.uid);setDeckView('cards')};
 function savePractice(notes:PracticeNotes){return update({...current.current,playRecords:{matches:current.current.playRecords?.matches??[],practice:[...(current.current.playRecords?.practice??[]).filter(p=>p.deckId!==notes.deckId),notes]}})}
 function recordMatch(record:MatchRecord){return update({...current.current,playRecords:saveMatch(current.current.playRecords,record)})}
 const optionsRef=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{try{localStorage.setItem('holocron-tools-deck',toolsDeckId);localStorage.setItem('holocron-tools-mode',toolsMode)}catch{}},[toolsDeckId,toolsMode]);
 useEffect(()=>{window.scrollTo(0,0)},[tab,deckId,deckView,toolsPanel]);
 const [importConfirmed,setImportConfirmed]=useState(false);
 const importInProgress=useRef(false);
 const [massEntry,setMassEntry]=useState<{name:string;text:string;unmatched:string[];copyError?:boolean}|null>(null);
 useEffect(()=>{
  if(!notice||modal==='import')return;
  const timeout=window.setTimeout(()=>setNotice(''),6000);
  return ()=>window.clearTimeout(timeout);
 },[notice,modal]);
 const cardColumns = workspace.settings?.cardColumns ?? 0;
 const sort = workspace.settings?.cardSort ?? defaultSort;
 const quickFilters = workspace.settings?.quickFilters ?? defaultQuickFilters;
 const showDeckMembership = workspace.settings?.showDeckMembership ?? false;
 const cardHighlights=highlightSettings(workspace.settings);
 const [presetId,setPresetId] = useState('');
 const [presetName,setPresetName] = useState('');
 useEffect(()=>{const s=workspace.settings;if(s?.theme)setTheme(s.theme);if(s?.view)setView(s.view);if(s?.size)setSize(s.size)},[workspace.settings]);
 function preferences(settings:NonNullable<Workspace['settings']>){update({...current.current,settings:{theme,view:view as 'grid'|'table'|'large',size,...current.current.settings,...settings}})}
 useEffect(()=>{document.documentElement.dataset.theme=theme==='light'?'light':'dark';document.documentElement.dataset.palette=theme;try{localStorage.setItem('holocron-theme',theme)}catch{}},[theme]);
 const [resolvingId,setResolvingId]=useState<string|null>(null);
 const [resolutionHistoryOpen,setResolutionHistoryOpen]=useState(false);
 const [deckListView,setDeckListView]=useState<'images'|'rows'>('images');
 const [historyItems,setHistoryItems]=useState<ChangePoint[]>([]);
 const [historyOpen,setHistoryOpen]=useState(false);
 const historyRef=useRef<ChangePoint[]>([]);
const revision=useRef(0),pending=useRef<Workspace|null>(null),saving=useRef(false),blocked=useRef(false),current=useRef(workspace),catalogDate=useRef(0);
 useEffect(()=>{
  let cancelled=false;
  void (async()=>{
   const response=await fetch('./catalog.json');
   if(!response.ok)throw Error('Could not load the bundled catalog.');
   const bundled=validateCatalog(await response.json());
   let latest=bundled;
   try{const cached=await readCachedCatalog();latest=cached?validateCatalog(cached):bundled}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'The cached catalog could not be read.')}
   if(cancelled)return;
   catalogDate.current=Date.parse(latest.updated)||0;
   setCatalog(latest);
   let endpoint='';
   try{endpoint=localStorage.getItem('holocron-sync-url')||defaultSyncServer()}catch{endpoint=defaultSyncServer()}
   if(!endpoint)return;
   try{
    const refreshed=await getRemoteCatalog(normalizeSyncUrl(endpoint));
    if(Date.parse(refreshed.updated)>catalogDate.current){
     const previous=new Map(latest.cards.map(card=>[card.id,card]));
     const refreshedIds=new Set(refreshed.cards.map(card=>card.id));
     const merged={...refreshed,cards:[
      ...refreshed.cards.map(card=>({...card,image:previous.get(card.id)?.image||card.image,back:previous.get(card.id)?.back||card.back})),
      ...latest.cards.filter(card=>!refreshedIds.has(card.id)),
     ]};
     await cacheCatalog(merged);
     catalogComparison.current={before:latest,after:refreshed};
     catalogDate.current=Date.parse(merged.updated)||catalogDate.current;
     if(!cancelled)setCatalog(merged);
    }
   }catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Unable to refresh the card catalog.')}
  })().catch(error=>{if(!cancelled)setError(error instanceof Error?error.message:'Could not load the card catalog.')});
  loadLocal().then(record=>{
   if(cancelled)return;
   current.current=record.data;
   revision.current=record.revision;
   setWorkspace(record.data);
   historyRef.current=readHistory(localStorage,workspaceKey,record.revision);
   setHistoryItems(historyRef.current);
   setLoaded(true);
   setStatus('Saved on this device');
  }).catch(error=>{if(!cancelled){setError(error.message);setStatus('Workspace unavailable')}});
  return ()=>{cancelled=true};
 },[]);
 useEffect(()=>{
  function guard(event:BeforeUnloadEvent){
   if(pending.current||saving.current){event.preventDefault();event.returnValue=''}
  }
  window.addEventListener('beforeunload',guard);
  return ()=>window.removeEventListener('beforeunload',guard);
 },[]);
 async function flush(){
  if(saving.current||blocked.current||!pending.current)return;
  saving.current=true;
  const data=pending.current;
  const history=historyRef.current;
  pending.current=null;
  setStatus('Saving…');
  try{
   const record=await saveLocal(data,revision.current);
   revision.current=record.revision;
   try{writeHistory(localStorage,workspaceKey,record.revision,history)}catch{}
   setStatus('Saved on this device');
   setError('');
  }catch(error){
   blocked.current=error instanceof WorkspaceConflict;
   pending.current??=data;
   setStatus('Unsaved changes');
   setError(error instanceof Error?error.message:'Unable to save this workspace.');
   return;
  }finally{
   saving.current=false;
  }
  if(pending.current)void flush();
 }
 function update(next:Workspace){
  if(!loaded||blocked.current||resolvingSync.current){if(resolvingSync.current)setError('Wait for the cloud conflict to finish resolving before editing.');return false}
  if(next!==current.current){
   const label=changeLabel(current.current,next),at=new Date().toISOString(),previous=historyRef.current[0];
   const point={at,label,before:current.current};
   historyRef.current=previous?.label===label&&Date.now()-Date.parse(previous.at)<2000
    ?[{...previous,at},...historyRef.current.slice(1)]
    :[point,...historyRef.current].slice(0,8);
   setHistoryItems(historyRef.current);
  }
  queueSave(next);
  return true;
 }
 function queueSave(next:Workspace){
  current.current=next;
  setWorkspace(next);
  pending.current=next;
  void flush();
 }
 function restoreHistory(index:number){
  const point=historyRef.current[index];
  if(!point||!loaded||blocked.current||resolvingSync.current)return;
  historyRef.current=[{at:new Date().toISOString(),label:'Before restore',before:current.current},...historyRef.current.filter((_,i)=>i!==index)].slice(0,8);
  setHistoryItems(historyRef.current);
  queueSave(point.before);
  setNotice('Workspace restored. The previous state is available in History.');
 }

 const favorites=workspace.favorites||{cards:[],decks:[]};
 function favorite(kind:'cards'|'decks',id:string){update(toggleFavorite(current.current,kind,id))}
 function cardStar(c:Card,position=''){return <><FavoriteButton className={position} active={favorites.cards.includes(c.id)} label={label(c)+' '+c.id} disabled={!loaded} onClick={()=>favorite('cards',c.id)}/><CardValueLabel card={c}/></>}
 const lists=workspace.lists||[];
 function createList(){const name=listName.trim();if(!name)return;const list={uid:makeId(),name,cards:listCard?[listCard.id]:[]};update({...current.current,lists:[...(current.current.lists||[]),list]});setListId(list.uid);setListName('');setListCard(null);setNotice('Created '+name)}
 function listButton(c:Card){return <button className="add-list" disabled={!loaded} aria-label={'Add '+c.name+' to a list'} onClick={()=>{setListName('');setListCard(c)}}><List size={15}/>List</button>}
 function membership(c:Card,compact=false){
  const decks=deckMembership(c,workspace.decks,byId);
  const links=<div className="membership">{decks.map(d=><button key={d.uid} onClick={()=>{nav('deck');setDeckId(d.uid);setDeckView('cards')}}>{d.name}</button>)}</div>;
  if(compact)return decks.length>0?<details key={String(showDeckMembership)} className="card-membership" open={showDeckMembership}><summary>In {decks.length} {decks.length===1?'deck':'decks'}</summary>{links}</details>:null;
  return decks.length?links:<span className="muted">No decks</span>;
 }
 const [folderFilter,setFolderFilter]=useState('');
 const [folderName,setFolderName]=useState('');
 const [deleteDeckId,setDeleteDeckId]=useState('');
 const folders=workspace.settings?.deckFolders??[];
 const folderByDeck=new Map(folders.flatMap(folder=>folder.deckIds.map(id=>[id,folder.uid] as const)));
 const selectedFolder=folders.find(folder=>folder.uid===folderFilter);
 const deckToDelete=workspace.decks.find(deck=>deck.uid===deleteDeckId);
 function createFolder(){
  const name=folderName.trim();
  if(!name||folders.length>=500)return;
  if(folders.some(folder=>folder.name.toLowerCase()===name.toLowerCase())){setNotice('A folder with that name already exists.');return}
  preferences({deckFolders:[...folders,{uid:makeId(),name,deckIds:[]}]});
  setFolderName('');
 }
 function moveDeckToFolder(deckId:string,folderId:string){
  const currentFolders=current.current.settings?.deckFolders??[];
  preferences({deckFolders:currentFolders.map(folder=>({
   ...folder,deckIds:[...folder.deckIds.filter(id=>id!==deckId),...(folder.uid===folderId?[deckId]:[])],
  }))});
 }
 function askToDeleteDeck(id:string){setDeleteDeckId(id);setModal('delete')}
 function deleteDeck(){
  if(!deckToDelete)return;
  const previous=current.current;
  const id=deckToDelete.uid;
  const next={...previous,decks:previous.decks.filter(deck=>deck.uid!==id),deckVersions:(previous.deckVersions??[]).filter(version=>version.deckId!==id),
   ...(previous.favorites&&{favorites:{...previous.favorites,decks:previous.favorites.decks.filter(uid=>uid!==id)}}),
   ...(previous.settings?.deckFolders&&{settings:{...previous.settings,deckFolders:previous.settings.deckFolders.map(folder=>({...folder,deckIds:folder.deckIds.filter(uid=>uid!==id)}))}}),
  };
  if(update(next)){
   setModal('');
   setDeleteDeckId('');
   if(tab==='deck')nav('decks');
  }
 }
 const visibleDecks=workspace.decks.filter(deck=>tab==='favorites'?favorites.decks.includes(deck.uid):
  folderFilter==='unfiled'?!folderByDeck.has(deck.uid):!selectedFolder||folderByDeck.get(deck.uid)===selectedFolder.uid);
 const showDecks=tab==='decks'||tab==='favorites'&&favoriteView==='decks';
 const showCardBrowser=tab==='catalog'||tab==='collection'||tab==='lists'||tab==='favorites'&&favoriteView==='cards'||tab==='deck'&&['cards','build'].includes(deckView);
 const cards=catalog?.cards||[];const byId=useMemo(()=>new Map(cards.map(c=>[c.id,c])),[catalog]);
 const premierIds=useMemo(()=>premierCards(cards,new Date(),workspace.formatRules),[catalog,workspace.formatRules]);
 const collection=useMemo(()=>effectiveCollection(workspace),[workspace.collection,workspace.resolutions]);
 const cardValues=useCardValues(workspace.settings?.showCardValues??false,collection,byId,syncToken);
 const owned=useMemo(()=>{const m=new Map<string,number>();for(const x of collection){const key=byId.get(x.id)?.core||x.id;m.set(key,(m.get(key)||0)+x.count)}return m},[collection,byId]);
 const foils = useMemo(() => {
  const totals = new Map<string, number>();
  for (const item of collection) if (item.foil) totals.set(item.id, (totals.get(item.id) ?? 0) + item.count);
  return totals;
 }, [collection]);
 const deckCores=useMemo(()=>new Set(workspace.decks.flatMap(d=>[d.leader,d.base,...d.deck.map(e=>e.id),...d.sideboard.map(e=>e.id)]).filter(Boolean).map(id=>byId.get(id)?.core??id)),[workspace.decks,byId]);
 useEffect(()=>{if(!loaded||!catalog)return;const missing=workspace.decks.filter(d=>!current.current.playRecords?.practice.some(p=>p.deckId===d.uid));if(missing.length)update({...current.current,playRecords:{matches:current.current.playRecords?.matches??[],practice:[...(current.current.playRecords?.practice??[]).filter(p=>current.current.decks.some(d=>d.uid===p.deckId)),...missing.map(d=>generatedPractice(d,byId))]}},false,false)},[loaded,catalog,workspace.decks]);
 const ownedExact=(id:string)=>count(collection.filter(x=>x.id===id));
 const active=workspace.decks.find(d=>d.uid===deckId);
 const toolDeck=workspace.decks.find(d=>d.uid===toolsDeckId);
 const leader=active?byId.get(active.leader):undefined,base=active?byId.get(active.base):undefined;
 function editDeck(fn:(d:Deck)=>Deck){if(active)update({...current.current,decks:current.current.decks.map(d=>d.uid===active.uid?fn(d):d)})}
 const activeVersions=(workspace.deckVersions??[]).filter(version=>version.deckId===deckId).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
 function saveVersion(name:string){if(!active||activeVersions.length>=30||((current.current.deckVersions??[]).length>=200)){setNotice('Deck version limit reached. Delete an older version first.');return}const version={uid:makeId(),deckId:active.uid,name:name.slice(0,100),savedAt:new Date().toISOString(),deck:structuredClone(active)};if(update({...current.current,deckVersions:[...(current.current.deckVersions??[]),version]}))setNotice('Deck version saved and included in backups.')}
 function restoreVersion(version:typeof activeVersions[number]){if(!active)return;if((current.current.deckVersions??[]).length>=200){setNotice('Delete an older version before restoring.');return}const checkpoint={uid:makeId(),deckId:active.uid,name:'Before restore',savedAt:new Date().toISOString(),deck:structuredClone(active)};update({...current.current,deckVersions:[...(current.current.deckVersions??[]),checkpoint],decks:current.current.decks.map(d=>d.uid===active.uid?{...structuredClone(version.deck),uid:active.uid}:d)})}
 function deleteVersion(version:typeof activeVersions[number]){update({...current.current,deckVersions:(current.current.deckVersions??[]).filter(v=>v.uid!==version.uid)})}
 function newDeck(){const d:Deck={uid:makeId(),name:editName.trim()||'Untitled deck',author:'Holocron',leader:'',base:'',deck:[],sideboard:[],notes:''};update({...current.current,decks:[...current.current.decks,d]});setDeckId(d.uid);setTab('deck');setDeckView('guided');setModal('');setEditName('');resetFilters()}
 function add(c:Card,delta=1){if(!active){setNotice('Open or create a deck first.');return}const id=c.canonical||c.id;if(c.type==='Leader'){editDeck(d=>({...d,leader:id}));return}if(c.type==='Base'){editDeck(d=>({...d,base:id}));return}if(!['Unit','Event','Upgrade'].includes(c.type))return;editDeck(d=>{const a=[...d[section]],i=a.findIndex(x=>x.id===id);if(i<0&&delta>0)a.push({id,count:1});else if(i>=0)a[i]={...a[i],count:Math.max(0,a[i].count+delta)};return {...d,[section]:a.filter(x=>x.count>0)}})}
 function adjustOwned(c:Card,foil:boolean,delta:number){update(adjustEffectiveOwned(current.current,c.id,foil,delta))}
 function applyFilters(filters: CardFilters) {
  setQ(filters.q);
  setAspect(filters.aspect);
  setAspectMode(filters.aspectMode);
  setKinds(filters.kinds?.length?filters.kinds:kindsFromLegacyType(filters.type,filters.arena));
  setSet(filters.set);
  setKeyword(filters.keyword);
  setTrait(filters.trait);
  setRarity(filters.rarity);
  setFinish(filters.finish);
  setVariant(filters.variant);
  setArena(filters.arena);
  setAbility(filters.ability);
  setArtist(filters.artist);
  setMaxCost(filters.maxCost);
  setMinPower(filters.minPower);
  setMinHp(filters.minHp);
  setOnlyOwned(filters.onlyOwned);
  setOnlyUnowned(!filters.onlyOwned&&!!filters.onlyUnowned);
  setPremierOnly(filters.premierOnly ?? false);
  setAllPrintings(filters.allPrintings);
  setLimit(48);
 }
 function resetFilters(){applyFilters(emptyFilters)}
 function openQuickFilter(preset: QuickFilter) {
  nav(preset.scope);
  applyFilters(preset.filters);
  setPresetId(preset.id);
  setPresetName(preset.name);
 }
 function saveQuickFilter(replace: boolean) {
  const name = presetName.trim();
  if (!name || (replace ? !presetId : quickFilters.length >= 30)) return;
  const preset: QuickFilter = {
   id: replace ? presetId : makeId(), name, scope: tab === 'collection' ? 'collection' : 'catalog',
   filters: {q,aspect,aspectMode,type:'',kinds,set,keyword,trait,rarity,finish,variant,arena,ability,artist,maxCost,minPower,minHp,onlyOwned,onlyUnowned,premierOnly,allPrintings},
  };
  preferences({quickFilters: replace ? quickFilters.map(item => item.id === preset.id ? preset : item) : [...quickFilters, preset]});
  setPresetId(preset.id);
  setPresetName(name);
 }
 function changeSort(index: number, key: string) {
  const next = [...sort];
  if (!key) next.splice(index, 1);
  else {
   const other=next.findIndex(rule=>rule.key===key);
   if(other===index)return;
   if(other>=0&&next[index]) [next[index],next[other]]=[next[other],next[index]];
   else if(other>=0)return;
   else next[index]=sortRule(key as SortRule['key']);
  }
  preferences({cardSort: next});
 }
 function nav(t:string){setTab(t);resetFilters();setDeckId('')}
 function chooseHomePage(value:HomePage){setHomePage(value);try{localStorage.setItem(HOME_PAGE_KEY,value)}catch{}}
 function optionAction(action:()=>void){action();if(optionsRef.current)optionsRef.current.open=false}
 useEffect(()=>{const close=(event:MouseEvent)=>{if(optionsRef.current&&!optionsRef.current.contains(event.target as Node))optionsRef.current.open=false};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&optionsRef.current)optionsRef.current.open=false};document.addEventListener('click',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('click',close);document.removeEventListener('keydown',escape)}},[]);
 function resetImportPreview(){setPreview(null);setImportConfirmed(false)}
 function openImport(kind='collection'){setImportType(kind);setImportMode('add');setImportText('');resetImportPreview();importInProgress.current=false;setModal('import');setNotice('')}
 function validateImport(){setImportConfirmed(false);try{let data:any;if(importType==='collection')data=parseCollectionImport(importText);else if(importType==='deck')data=parseDeck(importText);else{const b=JSON.parse(importText);if(b.format!=='holocron-backup-v1'||!Array.isArray(b.data?.collection)||!Array.isArray(b.data?.decks))throw Error('Not a Holocron backup');data=b.data; // Validate through the same public interchange parsers.
 data=validateBackup(data,byId)}
 const refs: string[]=importType==='collection'?unresolvedCollection({...current.current,collection:data.collection,resolutions:data.resolutions},byId).map((x:Owned)=>x.id):importType==='deck'?[data.leader,data.base,...data.deck.map((x:any)=>x.id),...data.sideboard.map((x:any)=>x.id)]:[];setPreview({data,unknown:[...new Set(refs.filter(id=>!byId.has(id)))]});setNotice('')}catch(e:any){setPreview(null);setNotice(e.message)}}
 function importConfirmationText(){if(!preview)return '';if(importType==='collection'){const incoming=count(preview.data.collection),existing=count(current.current.collection);return importMode==='add'?`Add ${incoming.toLocaleString()} copies to the ${existing.toLocaleString()} already in my collection. Importing this file again will add them again.`:`Replace my current ${existing.toLocaleString()} copies with the ${incoming.toLocaleString()} copies in this file.`}return importType==='deck'?`Add “${preview.data.name}” to my decks. My collection quantities will not change.`:'Replace my current collection, decks, lists, and favorites with this full backup.'}
 function importActionLabel(){return importType==='collection'?(importMode==='add'?'Accept and add to collection':'Accept and replace collection'):importType==='deck'?'Accept and add deck':'Accept and restore backup'}
 function applyImport(){if(!preview||!importConfirmed||importInProgress.current)return;importInProgress.current=true;try{const d=preview.data;let next:Workspace;if(importType==='collection')next=applyCollectionImport(current.current,d,importMode as 'add'|'replace',byId);else if(importType==='deck')next={...current.current,decks:[...current.current.decks,d]};else next=d;if(!update(next)){importInProgress.current=false;return}if(importType==='deck'){setDeckId(d.uid);setTab('deck');setDeckView('cards')}setModal('');resetImportPreview();setNotice('Import complete. Your changes are being saved.');if(importType==='collection'){setTab('collection');setDeckId('');resetFilters()}}catch(e:any){importInProgress.current=false;setNotice(e.message)}}
 async function copyDeck(){if(!active)return;try{const text=JSON.stringify(deckExport(active),null,2);await nativeCall('copy',{text});setNotice('SWUDB JSON copied.')}catch{setNotice('Clipboard unavailable. Use SWUDB JSON to download the file.')}}
 function exportDeck(){if(!active)return;try{download(active.name.replace(/[^a-z0-9-]/gi,'_')+'_SWUDB.json',JSON.stringify(deckExport(active),null,2))}catch(e:any){setNotice(e.message)}}
 async function backup(){if(!loaded){setError('Wait for your collection to load before exporting a backup.');return}const file=createBackup(current.current);if(await download(file.name,file.text)){const at=new Date().toISOString();setLastBackup(at);setBackupClock(Date.now());try{localStorage.setItem('holocron-last-backup',at)}catch{setError('Backup exported, but its time could not be saved on this device.')}setNotice('Backup: '+file.name+'. On iPhone or iPad, choose Save to Files → iCloud Drive. Restore with Import collection → Full backup.')}}
 function saveSyncEndpoint(){
  const base=normalizeSyncUrl(syncUrl),previous=localStorage.getItem('holocron-sync-url')||'';
  let previousBase='';
  try{if(previous)previousBase=normalizeSyncUrl(previous)}catch{}
  localStorage.setItem('holocron-sync-url',base);
  setSyncUrl(base);
  if(previous&&previousBase!==base){
   localStorage.removeItem('holocron-sync-token');localStorage.removeItem('holocron-sync-email');localStorage.removeItem('holocron-sync-user-id');localStorage.removeItem('holocron-sync-auth-url');
   localStorage.removeItem('holocron-sync-username');setSyncUsername('');
   setSyncPassword('');setSyncPasswordConfirm('');setSyncInviteCode('');
   setSyncToken('');setSyncUserId(0);setSyncAccountUsername(null);setSyncAccountLoaded(false);setSyncStatus(null);setRemoteConflict(null);
  }
  return base;
 }
  function syncAuthMatches(base:string){
   try{return normalizeSyncUrl(localStorage.getItem('holocron-sync-auth-url')||'')===base}catch{return false}
  }
 function discardExpiredSyncSession(error:unknown){
  if((error as Error&{status?:number}).status!==401)return false;
  localStorage.removeItem('holocron-sync-token');localStorage.removeItem('holocron-sync-email');localStorage.removeItem('holocron-sync-user-id');localStorage.removeItem('holocron-sync-auth-url');
  setSyncToken('');setSyncUserId(0);setSyncAccountUsername(null);setSyncAccountLoaded(false);setRemoteConflict(null);
  return true;
 }
 async function syncAccount(action:'login'|'register'){
  setSyncBusy(true);setSyncMessage('');
  try{
   const base=saveSyncEndpoint();
   if(syncPassword!==syncPasswordConfirm&&action==='register')throw Error('The passwords do not match.');
   if(action==='register'){
    const result=await registerAccount(base,syncUsername,syncPassword,syncInviteCode);
    localStorage.setItem('holocron-sync-token',result.token);localStorage.setItem('holocron-sync-user-id',String(result.user.id));localStorage.setItem('holocron-sync-auth-url',base);
    storeSyncUsername(syncUsername.trim().toLowerCase());
    localStorage.removeItem('holocron-sync-email');
    setSyncToken(result.token);setSyncUserId(result.user.id);setSyncAccountUsername(syncUsername.trim().toLowerCase());setSyncAccountLoaded(true);setSyncStatus(null);
    setSyncPassword('');setSyncPasswordConfirm('');setSyncInviteCode('');
    setSyncMessage('Account created. Use this username and password on your own devices.');
   }else{
    const result=await loginAccount(base,syncUsername,syncPassword);
    localStorage.setItem('holocron-sync-token',result.token);localStorage.setItem('holocron-sync-user-id',String(result.user.id));localStorage.setItem('holocron-sync-auth-url',base);
    storeSyncUsername(syncUsername.trim().toLowerCase());
    localStorage.removeItem('holocron-sync-email');
    setSyncToken(result.token);setSyncUserId(result.user.id);setSyncAccountUsername(syncUsername.trim().toLowerCase());setSyncAccountLoaded(true);setSyncStatus(readSyncStatus(base,result.user.id));
    setSyncPassword('');setSyncPasswordConfirm('');
    setSyncMessage('Signed in to your collection.');
   }
  }catch(error){setSyncMessage(explainSyncError(error,'Unable to connect to the sync server.'))}
  finally{setSyncBusy(false)}
 }
 async function addSyncAccountCredentials(){
  setSyncBusy(true);setSyncMessage('');
  try{
   const base=saveSyncEndpoint();
   if(!syncToken||!syncAuthMatches(base))throw Error('Sign in to your collection before setting up a login.');
   if(syncPassword!==syncPasswordConfirm)throw Error('The passwords do not match.');
   const result=await setSyncAccountCredentials(base,syncToken,syncUsername,syncPassword,syncInviteCode);
   storeSyncUsername(result.username||'');
   setSyncAccountUsername(result.username);setSyncAccountLoaded(true);setSyncPassword('');setSyncPasswordConfirm('');setSyncInviteCode('');
   setSyncMessage('Login saved for this collection. Use it on your other devices.');
  }catch(error){setSyncMessage(discardExpiredSyncSession(error)?'This sign-in expired. Sign in again with your username and password.':explainSyncError(error,'Unable to save the login.'))}
  finally{setSyncBusy(false)}
 }
 async function signOutSync(){
  setSyncBusy(true);setSyncMessage('');
  try{const base=saveSyncEndpoint();if(syncToken&&syncAuthMatches(base))await logoutAccount(base,syncToken)}catch(error){setSyncMessage(error instanceof Error?error.message:'The server sign-out could not be confirmed.')}
  localStorage.removeItem('holocron-sync-token');localStorage.removeItem('holocron-sync-email');localStorage.removeItem('holocron-sync-user-id');localStorage.removeItem('holocron-sync-auth-url');
  setSyncToken('');setSyncUserId(0);setSyncAccountUsername(null);setSyncAccountLoaded(false);setRemoteConflict(null);
  setSyncBusy(false);
 }
 function closeSyncDialog(){
  setSyncOpen(false);setSyncPassword('');setSyncPasswordConfirm('');setSyncInviteCode('');
 }
 async function signOutAllSync(){
  setSyncBusy(true);setSyncMessage('');
  try{
   const base=saveSyncEndpoint();
   if(!syncToken||!syncAuthMatches(base))throw Error('Sign in before revoking device sessions.');
   await logoutAllAccounts(base,syncToken);
   localStorage.removeItem('holocron-sync-token');localStorage.removeItem('holocron-sync-email');localStorage.removeItem('holocron-sync-user-id');localStorage.removeItem('holocron-sync-auth-url');
   setSyncToken('');setSyncUserId(0);setSyncAccountUsername(null);setSyncAccountLoaded(false);setRemoteConflict(null);
   setSyncMessage('Signed out of all devices.');
  }catch(error){setSyncMessage(discardExpiredSyncSession(error)?'This sign-in expired. Sign in again with your username and password.':error instanceof Error?error.message:'Unable to sign out all devices.')}
  finally{setSyncBusy(false)}
 }
 async function refreshCardCatalog(){
  setSyncBusy(true);setSyncMessage('');
  try{
   const base=saveSyncEndpoint(),refreshed=await refreshRemoteCatalog(base),previous=new Map((catalog?.cards||[]).map(card=>[card.id,card]));
   const refreshedIds=new Set(refreshed.cards.map(card=>card.id));
   const merged={...refreshed,cards:[
    ...refreshed.cards.map(card=>({...card,image:previous.get(card.id)?.image||card.image,back:previous.get(card.id)?.back||card.back})),
    ...(catalog?.cards||[]).filter(card=>!refreshedIds.has(card.id)),
   ]};
   const changes=catalog?affectedDecks(catalog,refreshed,current.current.decks):[];
   await cacheCatalog(merged);catalogDate.current=Date.parse(merged.updated)||catalogDate.current;setCatalog(merged);setCatalogChanges(changes);
   setSyncMessage('Card information refreshed · '+new Date(merged.updated).toLocaleDateString()+'.');
  }catch(error){setSyncMessage(error instanceof Error?error.message:'Unable to refresh card information.')}
  finally{setSyncBusy(false)}
 }
 function syncCursorKey(){return 'holocron-sync-revision:'+normalizeSyncUrl(syncUrl)+':'+syncUserId}
 function syncStatusKey(){return 'holocron-sync-status:'+normalizeSyncUrl(syncUrl)+':'+syncUserId}
 function rememberWorkspaceSynced(remoteRevision:number,localRevision:number,lastSyncedAt=new Date().toISOString()){
  const record={lastSyncedAt,localRevision,remoteRevision};
  localStorage.setItem(syncCursorKey(),String(remoteRevision));
  localStorage.setItem(syncStatusKey(),JSON.stringify(record));
  setSyncStatus(record);
 }
 function showRemoteConflict(remote:{revision:number;updatedAt:string;data:Workspace}){setRemoteConflict(remote);setSyncMessage('The cloud workspace differs from this device. Choose which copy to keep.')}
 async function syncWorkspace(){
  if(syncInFlight.current)return;
  syncInFlight.current=true;
  setSyncBusy(true);setSyncFailed(false);setSyncMessage('Checking cloud workspace…');
  try{
   const base=saveSyncEndpoint();
   if(!loaded||pending.current||saving.current)throw Error('Wait for local changes to finish saving before syncing.');
   if(!syncToken||!syncAuthMatches(base))throw Error('Sign in to this sync server before syncing your workspace.');
   const snapshot=current.current,localRevision=revision.current;
   const savedRevision=Number(localStorage.getItem(syncCursorKey()));
   const cursorExists=localStorage.getItem(syncCursorKey())!==null&&Number.isSafeInteger(savedRevision);
   const result=await syncSnapshot({data:snapshot,localRevision,cursor:cursorExists?savedRevision:null,synced:syncStatus,read:()=>getRemoteWorkspace(base,syncToken),write:(expected,data)=>putRemoteWorkspace(base,syncToken,expected,data)});
   if(result.kind==='conflict'){showRemoteConflict(result.remote);setSyncOpen(true);return}
   rememberWorkspaceSynced(result.saved.revision,result.localRevision);setRemoteConflict(null);
   setSyncMessage(result.kind==='created'?'This device’s workspace is now backed up to your sync server.':result.kind==='unchanged'?'Workspace is up to date.':'Workspace synced · '+new Date(result.saved.updatedAt).toLocaleString()+'.');
  }catch(error){
   setSyncFailed(true);
   setSyncMessage(discardExpiredSyncSession(error)?'This sign-in expired. Sign in again with your username and password.':error instanceof Error?error.message:'Unable to sync this workspace.');
   if((error as Error&{status?:number}).status===409)setSyncOpen(true);
  }finally{syncInFlight.current=false;setSyncBusy(false)}
 }
 useEffect(()=>{
  if(!autoSync||!syncToken||!loaded||syncBusy||remoteConflict||pending.current||saving.current||blocked.current)return;
  const key=syncToken+':'+revision.current;
  if(autoAttempt.current===key)return;
  const timer=window.setTimeout(()=>{autoAttempt.current=key;void syncWorkspace()},2000);
  return()=>window.clearTimeout(timer);
 },[autoSync,syncToken,loaded,syncBusy,remoteConflict,workspace,status,autoRetry]);
 function changeAutoSync(enabled:boolean){
  try{localStorage.setItem('holocron-auto-sync',String(enabled));setAutoSync(enabled);autoAttempt.current=''}
  catch{setSyncMessage('Unable to save the automatic sync setting on this device.')}
 }
 function openHeaderSync(){
  setSyncMessage('');
  setSyncOpen(true);
  if(syncToken)void syncWorkspace();
 }
 async function resolveWorkspaceConflict(choice:'cloud'|'device'){
  if(!remoteConflict)return;
  resolvingSync.current=true;
  setSyncBusy(true);setSyncMessage('');
  try{
   const base=saveSyncEndpoint();
   if(!syncToken||!syncAuthMatches(base))throw Error('Sign in to this sync server before resolving the workspace conflict.');
   if(choice==='cloud'){
    if(pending.current||saving.current)throw Error('Wait for local changes to finish saving before restoring.');
    const restored=validateBackup(remoteConflict.data,byId),previous=current.current;
    const record=await saveLocal(restored,revision.current);
    const point={at:new Date().toISOString(),label:'Before cloud restore',before:previous};
    historyRef.current=[point,...historyRef.current].slice(0,8);setHistoryItems(historyRef.current);
    try{writeHistory(localStorage,workspaceKey,record.revision,historyRef.current)}catch{}
    current.current=record.data;revision.current=record.revision;setWorkspace(record.data);setStatus('Saved on this device');setError('');
    rememberWorkspaceSynced(remoteConflict.revision,record.revision);setSyncMessage('Cloud workspace restored to this device.');
   }else{
    if(pending.current||saving.current)throw Error('Wait for local changes to finish saving before replacing the cloud copy.');
    const snapshot=current.current,localRevision=revision.current;
    const saved=await putRemoteWorkspace(base,syncToken,remoteConflict.revision,snapshot);
    rememberWorkspaceSynced(saved.revision,localRevision);setSyncMessage('This device’s workspace replaced the cloud copy.');
   }
   setRemoteConflict(null);
  }catch(error){
   const status=(error as Error&{status?:number}).status;
   if(status===409){
    try{showRemoteConflict(await getRemoteWorkspace(saveSyncEndpoint(),syncToken))}
    catch(refreshError){setSyncMessage(refreshError instanceof Error?refreshError.message:'The cloud workspace changed again. Retry sync.')}
   }else setSyncMessage(discardExpiredSyncSession(error)?'This sign-in expired. Sign in again with your username and password.':error instanceof Error?error.message:'Unable to resolve the workspace conflict.');
  }finally{resolvingSync.current=false;setSyncBusy(false)}
 }
 function play(){if(!active||!confirm('This opens ForceTable and sends the selected deck in the link. Continue?'))return;if(forceMatch&&!confirm('There is an unrecorded ForceTable game. Replace it with a new game?'))return;try{const url=forceTableDeckUrl(active);const match:MatchRecord={uid:makeId(),deckId:active.uid,deckName:active.name,leader:active.leader,base:active.base,opponent:'',opponentLeader:'',opponentBase:'',result:'win',playedAt:new Date().toISOString(),rounds:0,myDamage:0,opponentDamage:0,notes:''};sessionStorage.setItem('holocron-force-match',JSON.stringify(match));forceMatchPending.current=true;setForceMatch(match);forceAway.current=true;window.open(url,'_blank','noopener,noreferrer');setNotice('Return here to record the result. If ForceTable did not open, allow pop-ups; verify the imported deck count there.')}catch(error){setNotice(error instanceof Error?error.message:'Unable to open ForceTable.')}}
 const browsingDeck=tab==='deck'&&active&&deckView==='cards';
 const results=useMemo(()=>{let list=cards;if(browsingDeck){const ids=new Set([active!.leader,active!.base,...active![section].map(x=>x.id)]);list=list.filter(c=>ids.has(c.id))}else if(tab==='lists'){const ids=new Set(workspace.lists?.find(l=>l.uid===listId)?.cards||[]);list=list.filter(c=>ids.has(c.id))}else if(tab==='favorites'){list=list.filter(c=>favorites.cards.includes(c.id))}else if(tab==='collection'){list=list.filter(c=>ownedExact(c.id)>0)}else if(!allPrintings)list=list.filter(c=>c.variant==='Normal'&&!c.foilOnly);const query=q.trim().toLowerCase();list=list.filter(c=>(!premierOnly||premierIds.has(c.id))&&(!query||[c.name,c.subtitle,c.id,c.text,c.backText,...c.traits,...c.keywords].join(' ').toLowerCase().includes(query))&&matchesAspects(c.aspects,aspect,aspectMode)&&matchesCardKinds(c,kinds)&&(!set||c.set===set)&&(!keyword||c.keywords.includes(keyword))&&(!trait||c.traits.includes(trait))&&(!rarity||c.rarity===rarity)&&(!variant||c.variant===variant)&&(!arena||c.arena===arena)&&(!ability||(c.text+' '+c.backText+' '+c.epic).toLowerCase().includes(ability.toLowerCase()))&&(!artist||c.artist===artist)&&(!maxCost||(c.cost!==null&&c.cost<=Number(maxCost)))&&(!minPower||(c.power!==null&&c.power>=Number(minPower)))&&(!minHp||(c.hp!==null&&c.hp>=Number(minHp)))&&(!onlyOwned||(owned.get(c.core)||0)>0)&&(!onlyUnowned||tab==='collection'||!owned.get(c.core))&&(!finish||collection.some(x=>x.id===c.id&&x.foil===(finish==='foil')&&x.count>0)));return list.slice().sort((a,b)=>compareCards(a,b,sort,owned,foils))},[catalog,collection,workspace.favorites,tab,browsingDeck,active,section,q,aspect,aspectMode,listId,workspace.lists,kinds,set,keyword,trait,rarity,finish,variant,arena,ability,artist,maxCost,minPower,minHp,onlyOwned,onlyUnowned,premierOnly,allPrintings,sort,owned,foils,premierIds]);
 useEffect(()=>setLimit(48),[q,aspect,aspectMode,listId,workspace.lists,kinds,set,keyword,trait,rarity,finish,variant,arena,ability,artist,maxCost,minPower,minHp,onlyOwned,onlyUnowned,premierOnly,allPrintings,tab,deckView,favoriteView]);
 const options=(key:'rarity'|'variant'|'artist'|'arena')=>[...new Set(cards.map(c=>c[key]).filter(Boolean))].sort();
 const allTraits=useMemo(()=>[...new Set(cards.flatMap(c=>c.traits))].sort(),[catalog]);const allKeywords=useMemo(()=>[...new Set(cards.flatMap(c=>c.keywords))].sort(),[catalog]);
 const warnings=active?deckWarnings(active,byId):[];
 const deckSectionCards=active?.[section].slice().sort((a,b)=>{
  const left=byId.get(a.id),right=byId.get(b.id);
  return left&&right?compareCards(left,right,sort,owned,foils):Number(!left)-Number(!right)||a.id.localeCompare(b.id);
 })??[];
 const deckTotal=active?count(active.deck):0;
 const required=new Map<string,{id:string;count:number}>();
 if(active){
  for(const entry of [...active.deck,...active.sideboard,{id:active.leader,count:1},{id:active.base,count:1}]){
   if(!entry.id)continue;
   const core=byId.get(entry.id)?.core??entry.id;
   const previous=required.get(core);
   required.set(core,{id:previous?.id??entry.id,count:(previous?.count??0)+entry.count});
  }
 }
 const missingCards=[...required].flatMap(([core,entry])=>{
  const shortage=entry.count-(owned.get(core)??0);
  return shortage>0?[{id:entry.id,count:shortage}]:[];
 });
 const missingTotal=count(missingCards);
 const [missingDestination,setMissingDestination]=useState('');
 useEffect(()=>setMissingDestination(''),[deckId]);
 function addMissingToList(name:string){
  if(!missingCards.length)return;
  const previous=current.current;
  const existing=previous.lists??[];
  const ids=missingCards.map(card=>card.id);
  if(missingDestination===':new'){
   if(!name||existing.length>=500)return;
   const list={uid:makeId(),name,cards:ids};
   if(update({...previous,lists:[...existing,list]})){
    setListId(list.uid);setMissingDestination('');setNotice('Created '+name+' with '+ids.length+' missing card entries.');
   }
   return;
  }
  const list=existing.find(list=>list.uid===missingDestination);
  if(!list)return;
  const present=new Set(list.cards.map(id=>byId.get(id)?.core??id));
  const additions=ids.filter(id=>!present.has(byId.get(id)?.core??id));
  if(!additions.length){setNotice('All missing cards are already in '+list.name+'.');return}
  if(list.cards.length+additions.length>30000){setNotice('That list has reached its card limit.');return}
  if(update({...previous,lists:existing.map(item=>item.uid===list.uid?{...item,cards:[...item.cards,...additions]}:item)})){
   setListId(list.uid);setMissingDestination('');setNotice('Added '+additions.length+' missing card entries to '+list.name+'.');
  }
 }
 function collectionQuantities(card:Card){
  return [false,true].map(foil=>{
   const copies=count(collection.filter(row=>row.id===card.id&&row.foil===foil));
   const finish=foil?'foil':'non-foil';
   return <div className="text-row" key={finish}><span>{foil?'Foil':'Non-foil'}</span><div className="stepper">
    <button disabled={!loaded||!copies} aria-label={'Remove '+finish+' copy'} onClick={()=>adjustOwned(card,foil,-1)}><Minus size={15}/></button>
    <b>{copies}</b>
    <button disabled={!loaded} aria-label={'Add '+finish+' copy'} onClick={()=>adjustOwned(card,foil,1)}><Plus size={15}/></button>
   </div></div>;
  });
 }
 const selectedList=tab==='lists'?lists.find(list=>list.uid===listId):undefined;
 const unresolvedListIds=selectedList?.cards.filter(id=>!byId.has(id))??[];
 function downloadList(format:'json'|'csv'){
  if(!selectedList||!catalog)return;
  const name=selectedList.name.replace(/[^a-z0-9-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,100)||'Card_List';
  void download(name+'.'+format,exportCardList(selectedList,byId,format));
 }

 function selectControl(value:string,onChange:(v:string)=>void,values:string[],placeholder:string){return <select aria-label={placeholder} value={value} onChange={e=>onChange(e.target.value)}><option value="">{placeholder}</option>{values.map(v=><option key={v}>{v}</option>)}</select>}
 const unresolved=catalog?unresolvedCollection(workspace,byId):[];
 const reviewed=(workspace.resolutions||[]).filter(r=>workspace.collection.some(x=>x.id===r.sourceId));
 function saveResolution(resolution:CollectionResolution|null){if(!resolvingId)return false;try{const next=setCollectionResolution(current.current,resolution,resolvingId,byId);if(!update(next))return false;setResolvingId(null);setNotice(resolution?'Resolution saved locally. Original rows and finishes are preserved.':'Resolution removed. Original rows are restored for review.');return true}catch(e:any){setError(e.message);return false}}
 function deleteImportedItem(){
  if(!resolvingId)return false;
  const data=current.current;
  const collection=data.collection.filter(row=>row.id!==resolvingId);
  if(collection.length===data.collection.length)return false;
  const next=setCollectionResolution({...data,collection},null,resolvingId,byId);
  if(!update(next))return false;
  setResolvingId(null);
  setNotice('Imported item deleted from your collection.');
  return true;
 }
 function openDeckSection(value:string){setDeckView(value);resetFilters();if(value==='build')setView('grid')}
 function metricJump(target:'all'|'unique'|'foil'|'catalog'|'sets'|'prints'){resetFilters();if(target==='foil')setFinish('foil');if(target==='unique')setView('table');if(target==='prints')setAllPrintings(true);requestAnimationFrame(()=>{document.getElementById('card-results')?.scrollIntoView({block:'start'});if(target==='sets'){const panel=document.querySelector('.filter-panel') as HTMLDetailsElement|null;if(panel)panel.open=true;(document.querySelector('select[aria-label="Set"]') as HTMLSelectElement|null)?.focus()}})}
 const hasLocalSyncChanges=syncStatus!==null&&(revision.current!==syncStatus.localRevision||!!pending.current||saving.current);
 const headerSyncState=!syncToken?'disconnected':!loaded?'checking':remoteConflict||syncFailed?'conflict':!syncStatus?'never':hasLocalSyncChanges?'pending':'synced';
 const headerSyncLabel=headerSyncState==='disconnected'?'Not connected':headerSyncState==='checking'?'Checking…':headerSyncState==='conflict'?'Needs attention':headerSyncState==='never'?'Not synced yet':headerSyncState==='pending'?'Changes not synced':'In sync';
 const lastSyncedLabel=syncStatus?new Date(syncStatus.lastSyncedAt).toLocaleString():'Never';
 return <CardValueProvider value={cardValues}><HighlightProvider value={{settings:cardHighlights,context:{premierIds,ownedByCore:owned,deckCores}}}><div className="shell"><header className="workspace-header">
  <div className="workspace-navigation"><button className="brand" aria-label="Holocron Standalone home" onClick={()=>nav(homePage)}><img className="brand-icon standalone-icon" src="./standalone-icon-192.png" alt="" width={44} height={44}/><span>HOLOCRON<small>STANDALONE</small><small className="site-version">v{APP_VERSION}</small></span></button><nav aria-label="Workspace">
   <button className={tab==='collection'?'selected':''} aria-current={tab==='collection'?'page':undefined} onClick={()=>nav('collection')}><Library size={19}/>My collection<span>{count(workspace.collection).toLocaleString()}</span></button>
   <button className={tab==='decks'||tab==='deck'?'selected':''} aria-current={tab==='decks'||tab==='deck'?'page':undefined} onClick={()=>nav('decks')}><Layers size={19}/>My decks<span>{workspace.decks.length}</span></button>
   <button className={tab==='catalog'?'selected':''} aria-current={tab==='catalog'?'page':undefined} onClick={()=>nav('catalog')}><Search size={19}/>Card catalog</button>
   <button className={tab==='lists'||tab==='favorites'?'selected':''} aria-current={tab==='lists'||tab==='favorites'?'page':undefined} onClick={()=>nav('lists')}><List size={19}/>Lists</button>
   <button className={tab==='tools'||tab==='guides'?'selected':''} aria-current={tab==='tools'||tab==='guides'?'page':undefined} onClick={()=>{setToolsDeckId(deckId||toolsDeckId);nav('tools')}}><Wrench size={19}/>Tools</button>
   <details className="options-menu" ref={optionsRef}><summary><Settings2 size={18}/>Options{status==='Unsaved changes'&&<span className="options-unsaved">!</span>}</summary><div className="options-popover">
    <div className="options-section"><strong>This page</strong><OfflineInstall/><button disabled={!loaded} onClick={()=>optionAction(backup)}><Download size={15}/>Backup workspace</button>
     {tab==='collection'&&<><button disabled={!loaded} onClick={()=>optionAction(()=>download('SWUDB_Collection.csv',exportCollection(workspace.collection,workspace.resolutions)))}><Download size={15}/>Export collection CSV</button><button disabled={!loaded} onClick={()=>optionAction(()=>openImport())}><Upload size={15}/>Import collection</button>{reviewed.length>0&&<button disabled={!loaded} onClick={()=>optionAction(()=>setResolutionHistoryOpen(true))}>Review saved resolutions ({reviewed.length})</button>}</>}
     {tab==='decks'&&<><button disabled={!loaded||!catalog} onClick={()=>optionAction(()=>setStarterPickerOpen(true))}><Download size={15}/>Import starter deck</button><button disabled={!loaded} onClick={()=>optionAction(()=>openImport('deck'))}><Upload size={15}/>Import deck</button><button disabled={!loaded} onClick={()=>optionAction(()=>{setEditName('');setModal('new')})}><Plus size={15}/>New deck</button></>}
     {tab==='deck'&&active&&<><FavoriteButton active={favorites.decks.includes(active.uid)} label={active.name} disabled={!loaded} onClick={()=>optionAction(()=>favorite('decks',active.uid))}/><button onClick={()=>optionAction(()=>{void copyDeck()})}><Copy size={15}/>Copy deck JSON</button><button onClick={()=>optionAction(exportDeck)}><Download size={15}/>Export deck JSON</button><button onClick={()=>optionAction(play)}><Play size={15}/>Play on ForceTable</button></>}
     {tab==='lists'&&selectedList&&<><button disabled={!catalog||!selectedList.cards.length} onClick={()=>optionAction(()=>downloadList('csv'))}><Download size={15}/>Export list CSV</button><button disabled={!catalog||!selectedList.cards.length} onClick={()=>optionAction(()=>downloadList('json'))}><Download size={15}/>Export list JSON</button><button disabled={!catalog||!selectedList.cards.length} onClick={()=>optionAction(()=>setMassEntry({name:selectedList.name,...exportMassEntry(selectedList,byId)}))}><Copy size={15}/>TCGplayer Mass Entry</button><button onClick={()=>optionAction(()=>{const name=prompt('Rename list',selectedList.name);if(name?.trim())update({...current.current,lists:lists.map(l=>l.uid===listId?{...l,name:name.trim().slice(0,200)}:l)})})}>Rename list</button><button className="danger" onClick={()=>optionAction(()=>{if(confirm('Delete this list? Your cards and decks will stay unchanged.')){update({...current.current,lists:lists.filter(l=>l.uid!==listId)});setListId('')}})}>Delete list</button></>}
    </div>
    <div className="options-section"><strong>Workspace</strong><button onClick={()=>optionAction(()=>{setSyncMessage('');setSyncOpen(true)})}><RotateCw size={15}/>Sync, backups & card updates</button><button disabled={!loaded||!historyItems.length} onClick={()=>optionAction(()=>setHistoryOpen(true))}><RotateCw size={15}/>History ({historyItems.length})</button><button onClick={()=>optionAction(()=>nav('updates'))}>Release updates</button></div>
    <div className="options-section"><strong>Display</strong><label className="home-page-setting">Home page<select aria-label="Home page" value={homePage} onChange={event=>chooseHomePage(normalizeHomePage(event.target.value))}>{homePageOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><small>Opens at startup and when you select the Holocron logo.</small></label><HighlightOptions disabled={!loaded} value={cardHighlights} onChange={next=>preferences({highlight:next,rarityBorders:false})}/><button disabled={!loaded} aria-pressed={showDeckMembership} onClick={()=>preferences({showDeckMembership:!showDeckMembership})}>Show decks on cards {showDeckMembership?'On':'Off'}</button><button disabled={!loaded} aria-pressed={cardValues.enabled} onClick={()=>preferences({showCardValues:!cardValues.enabled})}>Show card values {cardValues.enabled?'On':'Off'}</button><ThemePicker theme={theme} disabled={!loaded} onSelect={next=>preferences({theme:next})}/></div>
    <div className="options-status"><HardDrive size={15}/><span>{status}</span>{status==='Unsaved changes'&&<button onClick={()=>void flush()}>Retry</button>}</div><div className="options-version">Holocron {siteVersion}</div>
   </div></details>
  </nav></div>
  <div className="workspace-tools">
   <button className="primary header-sync-button" aria-label="Sync workspace" disabled={syncBusy||!!syncToken&&(!loaded||!!pending.current||saving.current)} onClick={openHeaderSync}><RotateCw size={12}/>{syncBusy?'Working…':'Sync'}</button>
   <div className="workspace-sync-status" data-state={headerSyncState} title="In-sync status reflects the last successful sync. Press Sync to check for changes from another device.">
    <strong className="workspace-sync-state">{headerSyncLabel}</strong><span>Last synced: {lastSyncedLabel}</span>
   </div>
  </div>
 </header>
 <div className="workspace-body">
 <main>
 {error&&<div className="error-banner"><AlertCircle size={18}/><span>{error}</span><button onClick={backup}>Backup</button>{pending.current&&!blocked.current&&<button onClick={flush}>Retry save</button>}<button onClick={()=>location.reload()}>Reload</button></div>}
 {notice&&<div className="notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
 {forceMatch&&!forceMatchOpen&&<div className="notice">ForceTable game awaiting a result. <button onClick={()=>setForceMatchOpen(true)}>Record result</button></div>}
 {catalogChanges.length>0&&<div className="notice">Updated card information affects {catalogChanges.length} saved {catalogChanges.length===1?'deck':'decks'}. <button onClick={()=>setSyncOpen(true)}>Review changes</button></div>}
 <div className="content"><div className="page-heading"><div className="page-heading-title"><div className="eyebrow">YOUR GALAXY, ORGANIZED</div><h1>{tab==='updates'?'Updates':tab==='lists'||tab==='favorites'?'Lists & favorites':tab==='guides'?'Your guide to the game':tab==='tools'?'Play tools':tab==='catalog'?'The card catalog':tab==='collection'?'Your collection':tab==='decks'?'Your deck workshop':active?.name||'Deck workshop'}</h1><p>{tab==='updates'?'What changed in Holocron.':tab==='lists'||tab==='favorites'?'Keep your lists and favorite cards or decks together.':tab==='guides'?'Learn the rules. Build your plan. Keep the useful answers close.':tab==='tools'?'Draw through a deck or track an in-person game.':tab==='catalog'?'Explore the galaxy. Find the cards that make your deck yours.':tab==='collection'?'Every card accounted for. Every possibility in view.':tab==='decks'?'Build something worth bringing to the table.':'Fine-tune the list. Get to know every card.'}</p></div><div className="page-heading-content">
{(tab==='catalog'||tab==='collection')&&<div className="metrics compact-metrics" aria-label="Collection shortcuts"><button className="metric-card" onClick={()=>metricJump(tab==='catalog'?'catalog':'all')}><span>{tab==='catalog'?'CARDS TO DISCOVER':'TOTAL CARDS'}</span><strong>{tab==='catalog'?cards.filter(c=>c.variant==='Normal'&&!c.foilOnly).length.toLocaleString():count(workspace.collection).toLocaleString()}</strong><small>{tab==='catalog'?'Browse standard printings':'View all owned cards'}</small></button><button className="metric-card" onClick={()=>metricJump(tab==='catalog'?'sets':'unique')}><span>{tab==='catalog'?'SETS IN THE ARCHIVE':'UNIQUE PRINTINGS'}</span><strong>{tab==='catalog'?catalog?.sets.length||'—':new Set(collection.map(x=>x.id)).size.toLocaleString()}</strong><small>{tab==='catalog'?'Choose a set':'View printing rows'}</small></button><button className="metric-card" onClick={()=>metricJump(tab==='catalog'?'prints':'foil')}><span>{tab==='catalog'?'ART PRINTINGS':'FOIL CARDS'}</span><strong>{tab==='catalog'?cards.length.toLocaleString():count(collection.filter(x=>x.foil)).toLocaleString()}</strong><small>{tab==='catalog'?'Browse all variants':'View owned foil cards'}</small></button></div>}
{(tab==='lists'||tab==='favorites')&&<div className="favorite-tabs list-hub-tabs" role="group" aria-label="Lists and favorites"><button aria-pressed={tab==='lists'} onClick={()=>nav('lists')}>My lists ({lists.length})</button><button aria-pressed={tab==='favorites'&&favoriteView==='cards'} onClick={()=>{setFavoriteView('cards');nav('favorites')}}>Favorite cards ({favorites.cards.length})</button><button aria-pressed={tab==='favorites'&&favoriteView==='decks'} onClick={()=>{setFavoriteView('decks');nav('favorites')}}>Favorite decks ({workspace.decks.filter(d=>favorites.decks.includes(d.uid)).length})</button></div>}
{(tab==='tools'||tab==='guides')&&<div className="favorite-tabs tools-mode tools-sections" role="group" aria-label="Tools sections"><button aria-pressed={tab==='tools'&&toolsPanel==='game'&&toolsMode==='practice'} onClick={()=>{setToolsMode('practice');setToolsPanel('game');setTab('tools')}}>Solo table</button><button type="button" onClick={()=>window.location.assign("./battle/index.html")}>Battle Lab · vs AI</button><button aria-pressed={tab==='tools'&&toolsPanel==='game'&&toolsMode==='live'} onClick={()=>{setToolsMode('live');setToolsPanel('game');setTab('tools')}}>Live tracker</button><button aria-pressed={tab==='guides'} onClick={()=>nav('guides')}><BookOpen size={15}/>Guides</button><select className="tools-extra-select" aria-label="More tools" value={toolsPanel==='game'?'':toolsPanel} onChange={e=>{setToolsPanel(e.target.value);setTab('tools')}}><option value="" disabled>More tools…</option><option value="buildable">What can I build?</option><option value="compare">Compare decks</option><option value="matches">Match history</option><option value="legality">Legality alerts</option><option value="achievements">Achievements</option></select></div>}
{tab==='tools'&&toolsPanel==='game'&&<div className="tools-controls"><label>Choose a deck<select aria-label="Deck for tools" value={toolDeck?.uid??''} onChange={e=>setToolsDeckId(e.target.value)}><option value="">Choose a deck</option>{workspace.decks.map(deck=><option key={deck.uid} value={deck.uid}>{deck.name}</option>)}</select></label></div>}
{tab==='decks'&&<div className="deck-folder-tools"><button className="primary" disabled={!loaded||!catalog} onClick={()=>setStarterPickerOpen(true)}><Download size={16}/>Import starter deck</button><button onClick={()=>{setToolsPanel('buildable');nav('tools')}}>What can I build?</button><button onClick={()=>{setToolsPanel('legality');nav('tools')}}>Legality alerts</button>
  <label>Show folder <select aria-label="Show folder" value={selectedFolder?.uid??(folderFilter==='unfiled'?'unfiled':'')} onChange={e=>setFolderFilter(e.target.value)}>
   <option value="">All decks</option><option value="unfiled">Unfiled</option>
   {folders.map(folder=><option key={folder.uid} value={folder.uid}>{folder.name}</option>)}
  </select></label>
  <form onSubmit={e=>{e.preventDefault();createFolder()}}>
   <input aria-label="New folder name" placeholder="Folder name" maxLength={80} value={folderName} onChange={e=>setFolderName(e.target.value)}/>
   <button type="submit" disabled={!loaded||!folderName.trim()||folders.length>=500}><Plus size={16}/>New folder</button>
  </form>
  {selectedFolder&&<button disabled={!loaded} onClick={()=>{if(confirm('Remove this folder? Its decks will become unfiled.')){preferences({deckFolders:folders.filter(folder=>folder.uid!==selectedFolder.uid)});setFolderFilter('')}}}>Remove folder</button>}
 </div>}
{tab==='deck'&&active&&<div className="deck-view-menu"><button className="primary deck-play-button" onClick={play}><Play size={18}/>Play on ForceTable<ArrowUpRight size={16}/></button><div className="deck-section-nav" role="group" aria-label="Deck sections">{[['cards','Cards'],['stats','Statistics'],['settings','Details']].map(([value,label])=><button key={value} aria-pressed={deckView===value} onClick={()=>openDeckSection(value)}>{label}</button>)}<select aria-label="More deck sections" value={['guided','build','assembly','replacements','compare'].includes(deckView)?deckView:''} onChange={e=>openDeckSection(e.target.value)}><option value="" disabled>More…</option><option value="guided">Guided build</option><option value="build">Build</option><option value="assembly">Assemble deck</option><option value="replacements">Owned replacements</option><option value="compare">Compare decks</option></select></div></div>}
</div></div>
 {unresolvedListIds.length>0&&<p className="notice">List cards without catalog matches: {unresolvedListIds.join(', ')}</p>}
 {tab==='lists'&&<section className="lists-toolbar"><div className="actions"><input aria-label="New list name" placeholder="New list name" maxLength={200} value={listName} onChange={e=>setListName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createList()}/><button disabled={!loaded||!listName.trim()} onClick={createList}><Plus size={16}/>Create list</button></div><div className="actions">{lists.map(l=><button key={l.uid} aria-pressed={listId===l.uid} onClick={()=>{setListId(l.uid);resetFilters()}}>{l.name} ({l.cards.length})</button>)}</div><p>Add cards using the List button on any card. Manage the selected list in Options.</p></section>}
 {tab==='guides'&&<Guides byId={byId} decks={workspace.decks} onDeck={id=>{nav('deck');setDeckId(id);setDeckView('cards')}} onCard={c=>{setDetail(c);setFlipped(false)}} onKeyword={k=>{nav('catalog');setKeyword(k);setAdvanced(true)}}/>}
 {tab==='tools'&&toolsPanel==='game'&&<section className="tools-workspace" aria-label="Play tools">{toolDeck?<GameTable key={toolDeck.uid+'-'+toolsMode} deck={toolDeck} byId={byId} mode={toolsMode} records={workspace.playRecords} onPractice={savePractice} onMatch={recordMatch}/>:<div className="empty"><Wrench size={30}/><h2>Choose a deck to use a tool</h2><p>Solo table lets you draw and play through a saved deck. Live tracker keeps score for an in-person game.</p>{!workspace.decks.length&&<button className="primary" onClick={()=>nav('decks')}>Go to My decks</button>}</div>}</section>}
 {tab==='updates'&&<ReleaseUpdates/>}
 {tab==='collection'&&<div className="actions collection-actions"><button onClick={()=>{setToolsPanel('achievements');nav('tools')}}>Achievements</button><button onClick={()=>{setToolsPanel('buildable');nav('tools')}}>What can I build?</button></div>}
 {tab==='collection'&&cardValues.enabled&&<section className="card-values-summary" aria-label="Card values"><ValueSummary {...cardValues.totals}/><button disabled={cardValues.busy||!loaded} onClick={()=>void cardValues.refresh()}>{cardValues.busy?'Checking values…':'Check owned card values'}</button><button disabled={cardValues.busy} onClick={()=>void cardValues.clear()}>Clear saved values</button><p>Indicative USD market prices via TCG API. Provider finish labels can be inaccurate; missing prices are excluded. Values are not appraisals.</p><p>This product uses TCGplayer data but is not endorsed or certified by TCGplayer. <a href="https://www.tcgplayer.com/search/star-wars-unlimited/product" target="_blank" rel="noreferrer">Search TCGplayer</a></p>{cardValues.message&&<p role="status">{cardValues.message}</p>}</section>}
 {tab!=='collection'&&cardValues.enabled&&cardValues.message&&<p role="status">{cardValues.message}</p>}
 {tab==='tools'&&toolsPanel==='matches'&&<MatchHistory workspace={workspace} byId={byId} onDelete={id=>update({...current.current,playRecords:{practice:current.current.playRecords?.practice??[],matches:(current.current.playRecords?.matches??[]).filter(m=>m.uid!==id)}})}/>}
 {catalog&&tab==='tools'&&toolsPanel==='buildable'&&<BuildableDecks workspace={workspace} catalog={catalog} onOpen={openSavedDeck} onImport={starter=>{setStarterInitialId(starter.id);setStarterPickerOpen(true)}}/>}
 {catalog&&tab==='tools'&&toolsPanel==='compare'&&<DeckCompare workspace={workspace} catalog={catalog}/>}
 {catalog&&tab==='tools'&&toolsPanel==='legality'&&<LegalityAlerts workspace={workspace} catalog={catalog} onOpen={openSavedDeck}/>}
 {catalog&&tab==='tools'&&toolsPanel==='achievements'&&<Achievements workspace={workspace} catalog={catalog}/>}
 {showDecks&&<><div className="section-line" id="card-results"><h2>{tab==='favorites'?'Favorite decks':selectedFolder?.name||(folderFilter==='unfiled'?'Unfiled':'All decks')} <span>{visibleDecks.length}</span></h2></div>{tab==='decks'&&<AcrossDeckPanel decks={workspace.decks} collection={collection} byId={byId}/>}<div className="deck-grid">{visibleDecks.map(d=>{const l=byId.get(d.leader);return <article key={d.uid} className="deck-tile-wrap">{tab==='decks'&&<button className="danger deck-delete" aria-label={'Delete '+d.name} disabled={!loaded} onClick={()=>askToDeleteDeck(d.uid)}><Trash2 size={15}/>Delete</button>}<FavoriteButton className="floating-star" active={favorites.decks.includes(d.uid)} label={d.name} disabled={!loaded} onClick={()=>favorite('decks',d.uid)}/><button className="deck-tile" onClick={()=>{setDeckId(d.uid);setTab('deck');setDeckView('cards');setView('grid');resetFilters()}}><div className="deck-art" data-rarity={l?.rarity}>{l?<img src={l.image} alt={label(l)}/>:<Layers size={48}/>}</div><div><Dots values={byId.get(d.leader)?.aspects||[]}/><h2>{d.name}</h2><p>{l?.name||'No leader selected'}</p><footer>{count(d.deck)} cards · {count(d.sideboard)} sideboard <ArrowUpRight size={18}/></footer></div></button>{tab==='decks'&&folders.length>0&&<div className="deck-tile-actions"><select aria-label={'Move '+d.name+' to folder'} disabled={!loaded} value={folderByDeck.get(d.uid)??''} onChange={e=>moveDeckToFolder(d.uid,e.target.value)}>
   <option value="">Unfiled</option>{folders.map(folder=><option key={folder.uid} value={folder.uid}>{folder.name}</option>)}
  </select></div>}</article>})}{tab==='decks'?<button className="new-deck-tile" disabled={!loaded} onClick={()=>setModal('new')}><Plus size={27}/><h3>Start a new deck</h3><p>Choose a leader. Find your angle.</p></button>:visibleDecks.length===0?<div className="empty"><h3>No favorite decks yet</h3><p>Star a deck in My decks to see it here.</p><button onClick={()=>nav('decks')}>Browse My decks</button></div>:null}</div></>}
 {catalog&&tab==='deck'&&active&&deckView==='replacements'&&<ReplacementsPanel deck={active} workspace={workspace} catalog={catalog} onInspect={card=>{setDetail(card);setFlipped(false)}}/>}
 {catalog&&tab==='deck'&&active&&deckView==='compare'&&<DeckCompare workspace={workspace} catalog={catalog} initialDeckId={active.uid}/>}
 {tab==='deck'&&active&&deckView==='assembly'&&<DeckAssembly key={active.uid} deck={active} byId={byId} collection={collection} aspectIcons={values=><Dots values={values}/>} onBack={()=>setDeckView('cards')}/>}
 {tab==='deck'&&active&&deckView!=='assembly'&&<><div className="deck-overview"><div className="commander">{leader?<Art card={leader} onClick={()=>{setDetail(leader);setFlipped(false)}}/>:<Shield size={35}/>}<div><small>LEADER</small><strong>{leader?.name||'Choose your leader'}</strong><Dots values={leader?.aspects||[]}/></div></div><div className="commander">{base?<Art card={base} onClick={()=>{setDetail(base);setFlipped(false)}}/>:<Box size={35}/>}<div><small>BASE</small><strong>{base?.name||'Choose your base'}</strong><Dots values={base?.aspects||[]}/></div></div><div className="deck-count"><strong>{deckTotal}<small> / 50+</small></strong><span>Main deck cards</span></div><div className="deck-count"><strong>{missingTotal}</strong><span>Copies missing</span></div></div>
 {catalog&&missingCards.length>0&&<form className="missing-list-tools" key={active.uid} onSubmit={event=>{
  event.preventDefault();
  addMissingToList(String(new FormData(event.currentTarget).get('missingListName')??'').trim());
 }}>
  <label>Add missing cards to <select aria-label="Add missing cards to" value={missingDestination} onChange={e=>setMissingDestination(e.target.value)}>
   <option value="">Choose a list</option><option value=":new" disabled={lists.length>=500}>New list</option>
   {lists.map(list=><option key={list.uid} value={list.uid}>{list.name}</option>)}
  </select></label>
  {missingDestination===':new'&&<input name="missingListName" aria-label="Missing cards list name" defaultValue={('Missing · '+active.name).slice(0,200)} maxLength={200} required/>}
  <button type="submit" disabled={!loaded||!missingDestination}><List size={16}/>{missingDestination===':new'?'Create list':'Add all missing'}</button>
  <small>{missingCards.length} distinct cards · {missingTotal} copies short</small>
 </form>}
 </>}
 {tab==='deck'&&active&&deckView==='guided'&&<GuidedDeck key={active.uid} deck={active} cards={cards} byId={byId} owned={owned} premierIds={premierIds} onEdit={editDeck} onDetail={card=>{setDetail(card);setFlipped(false)}} onExport={exportDeck} onOpenBrowser={()=>{setDeckView('build');setView('grid');resetFilters()}}/>}
 {tab==='deck'&&active&&deckView==='stats'&&<div className="stats"><div className="stat-panel"><h2>Resource curve</h2><p>Printed costs · main deck only</p><div className="bars">{Array.from({length:10},(_,n)=>{const v=active.deck.reduce((s,x)=>{const c=byId.get(x.id);return s+(c&&c.cost!==null&&Math.min(9,c.cost)===n?x.count:0)},0);return <div key={n}><span>{v}</span><i style={{height:Math.max(3,v*7)+'px'}}/><small>{n===9?'9+':n}</small></div>})}</div></div><div className="stat-panel"><h2>Deck composition</h2>{['Ground','Space','Event','Upgrade'].map(k=>{const n=active.deck.reduce((s,x)=>s+(byId.get(x.id)?.arena===k||byId.get(x.id)?.type===k?x.count:0),0);return <div className="breakdown" key={k}><span>{k}</span><div><i style={{width:(deckTotal?n/deckTotal*100:0)+'%'}}/></div><strong>{n}</strong></div>})}<hr/><p>{deckTotal} main · {count(active.sideboard)} sideboard · {missingTotal} missing copies</p></div><div className="stat-panel"><h2>Draw probability</h2><p>Chance of seeing at least one copy, without a mulligan.</p><div className="form-row"><label>Copies in deck<input type="number" min="0" max={deckTotal} value={copies} onChange={e=>setCopies(Math.min(deckTotal,Math.max(0,Number(e.target.value))))}/></label><label>Cards drawn<input type="number" min="0" max={deckTotal} value={draws} onChange={e=>setDraws(Math.min(deckTotal,Math.max(0,Number(e.target.value))))}/></label></div><strong className="probability">{(probability(deckTotal,copies,draws)*100).toFixed(1)}<small>%</small></strong></div><div className="stat-panel"><h2>Aspect check</h2><p>Baseline penalty from leader + base. Card-specific exceptions and alternate costs can change this.</p>{active.deck.filter(x=>{const c=byId.get(x.id);return c&&aspectPenalty(c,leader,base)>0}).map(x=><div className="text-row" key={x.id}><span>{byId.get(x.id)?.name} ×{x.count}</span><b>+{aspectPenalty(byId.get(x.id)!,leader,base)}</b></div>)}{active.deck.every(x=>!byId.get(x.id)||!aspectPenalty(byId.get(x.id)!,leader,base))&&<p className="success"><CheckCircle2 size={16}/>No baseline aspect penalties</p>}</div><div className="stat-panel"><h2>Keywords & traits</h2><div className="tags">{[...new Set(active.deck.flatMap(x=>byId.get(x.id)?.keywords||[]))].map(k=><span key={k}>{k} <b>{active.deck.reduce((s,x)=>s+(byId.get(x.id)?.keywords.includes(k)?x.count:0),0)}</b></span>)}</div><hr/><div className="tags">{[...new Set(active.deck.flatMap(x=>byId.get(x.id)?.traits||[]))].map(k=><span key={k}>{k} <b>{active.deck.reduce((s,x)=>s+(byId.get(x.id)?.traits.includes(k)?x.count:0),0)}</b></span>)}</div></div><FormatPanel deck={active} byId={byId} premierIds={premierIds} rules={workspace.formatRules} onRulesChange={rules=>update({...current.current,formatRules:rules})}/><div className="stat-panel"><h2>Deck checks</h2>{warnings.length?warnings.map((w,i)=><p className="warning" key={i}>{w}</p>):<p className="success">Basic construction checks pass.</p>}<p className="muted">These checks do not certify tournament legality. Check current bans, rotation, and special card rules before an event.</p><span className="muted">See Guides for the local rules reference.</span></div></div>}
 {tab==='deck'&&active&&deckView==='settings'&&<VersionsPanel deck={active} versions={activeVersions} byId={byId} onSave={saveVersion} onRestore={restoreVersion} onDelete={deleteVersion}/>}
 {tab==='deck'&&active&&deckView==='settings'&&<div className="settings-panel"><h2>Deck details</h2><label>Name<input value={active.name} maxLength={200} onChange={e=>editDeck(d=>({...d,name:e.target.value}))}/></label><label>Author<input value={active.author} onChange={e=>editDeck(d=>({...d,author:e.target.value.slice(0,200)}))}/></label><label>Notes & game plan<textarea rows={6} value={active.notes} onChange={e=>editDeck(d=>({...d,notes:e.target.value.slice(0,20000)}))}/></label><div className="actions"><button onClick={()=>{const d={...active,uid:makeId(),name:active.name+' (copy)'};update({...current.current,decks:[...current.current.decks,d]});setDeckId(d.uid)}}><Copy size={16}/>Duplicate deck</button><button className="danger" onClick={()=>askToDeleteDeck(active.uid)}><Trash2 size={16}/>Delete deck</button></div></div>}
 {showCardBrowser&&<><div className="section-line" id="card-results"><h2>{tab==='deck'?(deckView==='build'?'Find your next card':'The deck, in full'):tab==='lists'?(lists.find(l=>l.uid===listId)?.name||'Select or create a list'):tab==='collection'?(finish==='foil'?'Foil cards':'Your cards'):tab==='favorites'?'Favorite cards':'Browse cards'} <span>{results.length.toLocaleString()}</span></h2><div className="view-controls card-view-toggle" aria-label="Card display"><span className="card-view-label">View cards as</span><button aria-label="Card images" aria-pressed={view==='grid'} className={view==='grid'?'active':''} onClick={()=>preferences({view:'grid'})}><Grid2X2 size={17}/> Card images</button><button aria-label="Table view" aria-pressed={view==='table'} className={view==='table'?'active':''} onClick={()=>preferences({view:'table'})}><List size={19}/> Table</button><button aria-label="Large images" aria-pressed={view==='large'} className={view==='large'?'active':''} onClick={()=>preferences({view:'large',size:380})}><BookOpen size={18}/> Large images</button></div></div><details className="filter-panel"><summary><SlidersHorizontal size={16}/>Search & filters{tab==='deck'?' · '+(section==='deck'?'Main deck':'Sideboard'):''}{finish==='foil'?' · Foil cards':q?' · '+q:aspect.length||kinds.length||set||keyword||trait||rarity||onlyOwned||onlyUnowned||premierOnly?' · Active':''}</summary><div className="filter-box">{tab==='deck'&&active&&<div className="deck-section-filter"><strong>{deckView==='build'?'Add cards to':'Show cards from'}</strong><div role="group" aria-label="Deck card section"><button aria-pressed={section==='deck'} onClick={()=>setSection('deck')}>Main deck ({deckTotal})</button><button aria-pressed={section==='sideboard'} onClick={()=>setSection('sideboard')}>Sideboard ({count(active.sideboard)})</button></div></div>}<div className="filter-row"><div className="search"><Search size={18}/><input aria-label="Search cards" placeholder="Search cards, abilities, traits…" value={q} onChange={e=>setQ(e.target.value)}/>{q&&<button aria-label="Clear search" onClick={()=>setQ('')}><X size={14}/></button>}</div><details className="aspect-picker"><summary>Aspects{aspect.length?' · '+aspect.length:' · All'}</summary><div>{aspects.map(a=><label key={a}><input type="checkbox" aria-label={a} checked={aspect.includes(a)} onChange={()=>setAspect(aspect.includes(a)?aspect.filter(x=>x!==a):[...aspect,a])}/><Dots values={[a]}/>{a}</label>)}<label>Match<select aria-label="Aspect match mode" value={aspectMode} onChange={e=>setAspectMode(e.target.value)}><option value="any">Any selected</option><option value="all">All selected</option></select></label><button onClick={()=>setAspect([])}>Clear aspects</button></div></details><CardKindPicker value={kinds} onChange={next=>{setKinds(next);setArena('')}}/><select aria-label="Set" value={set} onChange={e=>setSet(e.target.value)}><option value="">All sets</option>{catalog?.sets.map(s=><option value={s.code} key={s.code}>{s.code} · {s.name}</option>)}</select><button className={advanced?'filter-active':''} onClick={()=>setAdvanced(!advanced)}><SlidersHorizontal size={16}/>Filters</button></div>{advanced&&<div className="advanced">{selectControl(keyword,setKeyword,allKeywords,'Any keyword')}{selectControl(trait,setTrait,allTraits,'Any trait')}{selectControl(rarity,setRarity,options('rarity'),'Any rarity')}{selectControl(variant,setVariant,options('variant'),'Any art variant')}{selectControl(arena,v=>{setArena(v);if(v)setKinds([])},options('arena'),'Any arena')}{selectControl(artist,setArtist,options('artist'),'Any artist')}<select aria-label="Owned finish" value={finish} onChange={e=>setFinish(e.target.value)}><option value="">Any owned finish</option><option value="foil">Owned foil</option><option value="normal">Owned non-foil</option></select><input aria-label="Maximum cost" type="number" min="0" placeholder="Max cost" value={maxCost} onChange={e=>setMaxCost(e.target.value)}/><input aria-label="Minimum power" type="number" placeholder="Min power" value={minPower} onChange={e=>setMinPower(e.target.value)}/><input aria-label="Minimum HP" type="number" placeholder="Min HP" value={minHp} onChange={e=>setMinHp(e.target.value)}/><input aria-label="Ability text" placeholder="Ability contains…" value={ability} onChange={e=>setAbility(e.target.value)}/><button onClick={resetFilters}>Reset filters</button></div>}<div className="filter-bottom"><div><label className="checkbox"><input type="checkbox" checked={onlyOwned} onChange={e=>{setOnlyOwned(e.target.checked);if(e.target.checked)setOnlyUnowned(false)}}/>Only owned</label>{tab!=='collection'&&<label className="checkbox"><input type="checkbox" checked={onlyUnowned} onChange={e=>{setOnlyUnowned(e.target.checked);if(e.target.checked)setOnlyOwned(false)}}/>Unowned only</label>}<label className="checkbox"><input type="checkbox" checked={premierOnly} onChange={e=>setPremierOnly(e.target.checked)}/>Premier only</label>{<label className="checkbox"><input type="checkbox" checked={allPrintings} onChange={e=>setAllPrintings(e.target.checked)}/>All art variants</label>}{aspect.map(a=><button key={a} className="chip" onClick={()=>setAspect(aspect.filter(x=>x!==a))}>{a}<X size={12}/></button>)}{kinds.map(kind=><button key={kind} className="chip" aria-label={"Remove "+(cardKindOptions.find(option=>option.value===kind)?.label??kind)+" filter"} onClick={()=>setKinds(kinds.filter(value=>value!==kind))}>{cardKindOptions.find(option=>option.value===kind)?.label??kind}<X size={12}/></button>)}</div><div>{view==='grid'&&<label className="cards-across">Cards across<input aria-label="Cards across" aria-valuetext={cardColumns?String(cardColumns):'Auto'} type="range" min="0" max="8" step="1" disabled={!loaded} value={cardColumns} onChange={e=>preferences({cardColumns:Number(e.target.value)})}/><output>{cardColumns||'Auto'}</output></label>}<ArrowDownUp size={14}/><div className="sort-controls">
 {[0,1].map(index=><div key={index}><label>{index===0?'Sort by':'Then by'}
  <select disabled={!loaded} value={sort[index]?.key??''} onChange={event=>changeSort(index,event.target.value)}>
   {index===1&&<option value="">None</option>}
   {Object.entries(sortLabels).filter(([key])=>index===0||!!sort[1]||key!==sort[0].key).map(([key,name])=><option key={key} value={key}>{name}</option>)}
  </select></label>
  {sort[index]&&<select disabled={!loaded} aria-label={index===0?'Primary sort direction':'Secondary sort direction'} value={sort[index].direction}
   onChange={event=>preferences({cardSort:sort.map((rule,i)=>i===index?{...rule,direction:event.target.value as SortRule['direction']}:rule)})}>
   <option value="asc">Ascending</option><option value="desc">Descending</option>
  </select>}
 </div>)}
 <button type="button" disabled={!loaded} onClick={()=>preferences({cardSort:defaultSort})}>Reset sort</button>
 </div></div></div>
 <div className="quick-editor" role="group" aria-label="Quick filters">
  <strong>Quick filters</strong>
  {quickFilters.length>0&&<div className="quick-editor-buttons" aria-label="Apply a quick filter">{quickFilters.map(preset=><button type="button" key={preset.id} onClick={()=>openQuickFilter(preset)}><Bookmark size={15}/>{preset.name}</button>)}</div>}
  <div className="quick-editor-controls">
   <label>Preset<select value={presetId} onChange={event=>{
    const preset=quickFilters.find(item=>item.id===event.target.value);
    if(preset)openQuickFilter(preset);
    else {setPresetId('');setPresetName('')}
   }}><option value="">New preset</option>{quickFilters.map(preset=><option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
   <label>Name<input value={presetName} maxLength={60} onChange={event=>setPresetName(event.target.value)} placeholder="Name this filter"/></label>
   <button disabled={!loaded||!presetName.trim()||quickFilters.length>=30} onClick={()=>saveQuickFilter(false)}>Save as new</button>
   {presetId&&<>
    <button onClick={()=>{const preset=quickFilters.find(item=>item.id===presetId);if(preset)openQuickFilter(preset)}}>Apply preset</button>
    <button disabled={!loaded||!presetName.trim()} onClick={()=>saveQuickFilter(true)}>Update preset</button>
    <button disabled={!loaded} onClick={()=>{preferences({quickFilters:quickFilters.filter(item=>item.id!==presetId)});setPresetId('');setPresetName('')}}>Delete preset</button>
   </>}
  </div>
  <p>Saved presets apply to the current card view, including deck building.</p>
 </div>
 </div></details>

 {tab==='collection'&&catalog&&unresolved.length>0&&<section className="unresolved" aria-label="Collection resolutions"><h3 role="status" aria-live="polite">{unresolved.length} unresolved collection rows</h3><p>Choose a row to find a catalog match, keep it as a token or non-catalog item, or ignore it. Original quantities and finishes stay preserved.</p><div className="tags">{unresolved.map(x=><button disabled={!loaded} key={x.id+String(x.foil)} onClick={()=>setResolvingId(x.id)}>{x.id} · {x.foil?'foil':'normal'} ×{x.count}<ArrowUpRight size={14}/></button>)}</div></section>}
 {tab==='deck'&&active&&deckView==='cards'&&[...active.deck,...active.sideboard].some(x=>!byId.has(x.id))&&<div className="unresolved">Unresolved deck IDs: {[...active.deck,...active.sideboard].filter(x=>!byId.has(x.id)).map(x=>`${x.id} ×${x.count}`).join(', ')}. Preserved in exports.</div>}
 <div className={tab==='deck'&&deckView==='build'?'builder-layout':''}><div>{!catalog?<div className="empty"><RotateCw size={30}/><h2>Opening the archive…</h2><p>Loading card information and artwork.</p></div>:results.length===0?<div className="empty"><Package size={35}/><h2>{tab==='lists'?'Your list is ready for cards':tab==='collection'&&!workspace.collection.length?'Your collection starts here':tab==='deck'&&deckView==='cards'&&!active?.[section].length?'Your deck is ready for cards':tab==='favorites'?'No favorite cards in this view':'No cards match this view'}</h2><p>{tab==='lists'?'Browse the catalog and use the List button to add cards here.':tab==='collection'&&!workspace.collection.length?'Import your SWUDB CSV to see everything you own.':tab==='deck'&&deckView==='cards'&&!active?.[section].length?'Open Build to browse card images, search the catalog, and add your first cards.':tab==='favorites'?'Tap the star on any card to keep it here. Favorites do not change your owned quantities.':'Try clearing a filter, or add cards to your deck.'}</p><button className="primary" disabled={!loaded} onClick={()=>tab==='lists'?nav('catalog'):tab==='collection'&&!workspace.collection.length?openImport():tab==='deck'&&deckView==='cards'&&!active?.[section].length?(setDeckView('build'),setView('grid'),resetFilters()):resetFilters()}>{tab==='lists'?'Browse catalog':tab==='collection'&&!workspace.collection.length?'Import collection':tab==='deck'&&deckView==='cards'&&!active?.[section].length?'Browse cards':'Clear filters'}</button></div>:view==='table'?<div className="table-scroll"><table><thead><tr><th>Favorite</th><th>Art</th><th>Card</th><th>Aspects</th><th>Cost</th><th>Type</th>{tab==='catalog'&&<><th scope="col">Arena</th><th scope="col">Keywords</th></>}<th>Power / HP</th><th>Rarity</th><th>Set / #</th><th>Owned</th><th>In decks</th><th>Lists</th>{active&&<th>Deck</th>}</tr></thead><tbody>{results.slice(0,limit).map((c,i)=><Fragment key={c.id}>{sort[0].key==='aspects'&&(i===0||aspectGroup(results[i-1])!==aspectGroup(c))&&<tr className="card-group"><th colSpan={12+Number(!!active)+(tab==='catalog'?2:0)}>{aspectGroup(c)}</th></tr>}<tr data-rarity={c.rarity}><td>{cardStar(c)}</td><td><button className="table-art-button" aria-label={'View image of '+c.name} onClick={()=>{setDetail(c);setFlipped(false)}}><Art card={c}/></button></td><td><button className="text-button" onClick={()=>{setDetail(c);setFlipped(false)}}><b>{c.name}</b><small>{c.subtitle}</small></button></td><td><Dots values={c.aspects}/></td><td>{c.cost??'—'}</td><td>{c.type}</td>{tab==='catalog'&&<><td>{c.arena||'—'}</td><td className="catalog-keywords">{c.keywords.join(', ')||'—'}</td></>}<td>{c.power??'—'} / {c.hp??'—'}</td><td>{c.rarity}</td><td>{c.id}</td><td className="owned-number">{owned.get(c.core)||0}</td><td>{membership(c)}</td><td>{listButton(c)}{tab==='lists'&&<button aria-label={'Remove '+c.name+' from list'} onClick={()=>update({...current.current,lists:lists.map(l=>l.uid===listId?{...l,cards:l.cards.filter(id=>id!==c.id)}:l)})}>Remove</button>}</td>{active&&<td><button onClick={()=>add(c)}><Plus size={15}/></button></td>}</tr></Fragment>)}</tbody></table></div>:<div className={'card-grid '+(view==='large'?'large-cards':'')} style={{'--card-size':size+'px',gridTemplateColumns:view==='grid'&&cardColumns?'repeat('+cardColumns+', minmax(0, 1fr))':undefined} as any}>{results.slice(0,limit).map(c=>{const n=owned.get(c.core)||0;const inDeck=active?.[section].filter(x=>byId.get(x.id)?.core===c.core).reduce((s,x)=>s+x.count,0)||0;return <article className="card-tile" data-rarity={c.rarity} key={c.id}>{cardStar(c,'floating-star')}<button className="art-button" aria-label={'View '+label(c)} onClick={()=>{setDetail(c);setFlipped(false)}}><Art card={c} back={!!tileBacks[c.id]}/>{tab==='collection'&&collection.some(x=>x.id===c.id&&x.foil)&&<span className="foil-badge">✦ FOIL</span>}{browsingDeck&&inDeck>0&&<span className="quantity-badge">×{inDeck}</span>}</button><div className="card-info"><div><span className="card-code">{c.set} · {c.number} <i>·</i> {c.rarity}</span><Dots values={c.aspects}/></div><h3>{c.name}</h3><p>{c.subtitle||c.type}</p><footer>{c.back&&<button aria-label={'Flip '+c.name} onClick={()=>setTileBacks({...tileBacks,[c.id]:!tileBacks[c.id]})}><RotateCw size={12}/></button>}<span className="card-ownership">{tab==='collection'?ownedExact(c.id):n} owned{inDeck>0&&<> · {inDeck} in {section==='deck'?'main deck':'sideboard'}</>}</span>
 {active&&['Leader','Base','Unit','Upgrade','Event'].includes(c.type)&&<button className="card-deck-action" disabled={!loaded} onClick={()=>add(c)}><Plus size={14}/>{c.type==='Leader'?'Set leader':c.type==='Base'?'Set base':section==='deck'?'Add to deck':'Add to sideboard'}</button>}
 <button disabled={!loaded} onClick={()=>setCollectionCard(c)}>{ownedExact(c.id)>0?'Edit collection':'Add to collection'}</button>
 <div className="card-list-actions">{listButton(c)}{tab==='lists'&&<button aria-label={'Remove '+c.name+' from list'} onClick={()=>update({...current.current,lists:lists.map(l=>l.uid===listId?{...l,cards:l.cards.filter(id=>id!==c.id)}:l)})}>Remove</button>}</div></footer>{membership(c,true)}</div></article>})}</div>}{results.length>limit&&<div className="load-more"><button onClick={()=>setLimit(limit+48)}>Show more cards <ChevronRight size={16}/></button><span>Showing {Math.min(limit,results.length)} of {results.length}</span></div>}</div>
 {tab==='deck'&&active&&deckView==='build'&&<aside className="deck-list" aria-label="Cards in this deck">
  <div className="deck-list-heading"><div><h3>{section==='deck'?'Main deck':'Sideboard'} <span>{count(active[section])}</span></h3><p>Choose cards from the catalog and adjust copies here.</p></div><div className="view-controls" aria-label="Deck list display"><button aria-label="Show deck card images" aria-pressed={deckListView==='images'} className={deckListView==='images'?'active':''} onClick={()=>setDeckListView('images')}><Grid2X2 size={16}/> Images</button><button aria-label="Show deck rows" aria-pressed={deckListView==='rows'} className={deckListView==='rows'?'active':''} onClick={()=>setDeckListView('rows')}><List size={17}/> Rows</button></div></div>
  {deckListView==='images'?<div className="deck-list-gallery">{deckSectionCards.map(x=>{const card=byId.get(x.id);return <div className="deck-list-card" key={x.id}><button className="deck-list-art" aria-label={'View '+(card?.name||x.id)} onClick={()=>{if(card){setDetail(card);setFlipped(false)}}}>{card?<Art card={card}/>:<span>{x.id}</span>}<b className="quantity-badge">×{x.count}</b></button><strong title={card?.name||x.id}>{card?.name||x.id}</strong><div className="stepper"><button aria-label={'Remove '+x.id} onClick={()=>editDeck(d=>({...d,[section]:d[section].map(e=>e.id===x.id?{...e,count:e.count-1}:e).filter(e=>e.count>0)}))}><Minus size={12}/></button><span>{x.count}</span><button aria-label={'Add '+x.id} onClick={()=>editDeck(d=>({...d,[section]:d[section].map(e=>e.id===x.id?{...e,count:e.count+1}:e)}))}><Plus size={12}/></button></div></div>})}</div>:deckSectionCards.map(x=><div className="deck-line" data-rarity={byId.get(x.id)?.rarity} key={x.id}><button className="deck-line-name" onClick={()=>{const c=byId.get(x.id);if(c){setDetail(c);setFlipped(false)}}}>{byId.get(x.id)?.name||x.id}<small>{byId.get(x.id)?.subtitle}</small></button><div className="stepper"><button aria-label={'Remove '+x.id} onClick={()=>editDeck(d=>({...d,[section]:d[section].map(e=>e.id===x.id?{...e,count:e.count-1}:e).filter(e=>e.count>0)}))}><Minus size={12}/></button><span>{x.count}</span><button aria-label={'Add '+x.id} onClick={()=>editDeck(d=>({...d,[section]:d[section].map(e=>e.id===x.id?{...e,count:e.count+1}:e)}))}><Plus size={12}/></button></div></div>)}
  {!active[section].length&&<p className="muted">Add cards from the catalog to start building.</p>}<div className="deck-list-footer">{warnings.slice(0,3).map((w,i)=><p key={i}>{w}</p>)}<button onClick={()=>setDeckView('stats')}><BarChart3 size={16}/>View statistics</button></div></aside>}</div></>}
 <footer className="page-footer"><span>HOLOCRON <i> / </i> A personal card archive</span><span>Catalog: {catalog?new Date(catalog.updated).toLocaleDateString():'Loading'} · <span>SWU-DB</span> & <span>SWU API</span><br/>Unofficial fan tool · Card art © Lucasfilm / Fantasy Flight Games</span></footer></div></main></div>
 {resolutionHistoryOpen&&<Modal label="Saved collection resolutions" onDismiss={()=>setResolutionHistoryOpen(false)}>
  <section className="modal">
   <div className="section-line"><h2>Saved collection resolutions</h2><button type="button" onClick={()=>setResolutionHistoryOpen(false)}>Close</button></div>
   <div className="quick-editor-buttons">{reviewed.map(r=><button type="button" key={r.sourceId} onClick={()=>{setResolutionHistoryOpen(false);setResolvingId(r.sourceId)}}>
    {r.sourceId} · {r.kind==='catalog'?'Mapped to '+r.targetId:r.kind==='ignored'?'Ignored':r.kind==='token'?'Token':'Non-catalog'}{r.name?' · '+r.name:''}
   </button>)}</div>
  </section>
 </Modal>}
 {resolvingId&&<CollectionResolver key={resolvingId} workspace={workspace} cards={cards} sourceId={resolvingId} onSave={saveResolution} onDelete={deleteImportedItem} onDismiss={()=>setResolvingId(null)}/>}
 {detail&&<Modal label={label(detail)} onDismiss={()=>setDetail(null)}><section className="detail-dialog" aria-label={label(detail)} onClick={e=>e.stopPropagation()}><button className="close" aria-label="Close card" onClick={()=>setDetail(null)}><X/></button><div className="detail-art"><Art card={detail} back={flipped}/><div className="actions">{cardStar(detail)}{detail.back&&<button onClick={()=>setFlipped(!flipped)}><RotateCw size={16}/>{flipped?'Front face':'Flip card'}</button>}<button onClick={()=>{const i=results.findIndex(c=>c.id===detail.id);if(i>0){setDetail(results[i-1]);setFlipped(false)}}} disabled={results.findIndex(c=>c.id===detail.id)<=0}><ChevronLeft size={16}/></button><button onClick={()=>{const i=results.findIndex(c=>c.id===detail.id);if(i>=0&&i<results.length-1){setDetail(results[i+1]);setFlipped(false)}}} disabled={results.findIndex(c=>c.id===detail.id)<0||results.findIndex(c=>c.id===detail.id)>=results.length-1}><ChevronRight size={16}/></button></div></div><div className="detail-content"><div className="eyebrow">{detail.id} · {detail.variant}</div><h2>{detail.name}</h2><h3>{detail.subtitle}</h3><Dots values={detail.aspects}/><div className="detail-stats"><span>Cost <b>{detail.cost??'—'}</b></span><span>Power <b>{detail.power??'—'}</b></span><span>HP <b>{detail.hp??'—'}</b></span></div><p className="rules-text">{flipped?detail.backText:detail.text}</p>{!flipped&&detail.epic&&<p className="rules-text">{detail.epic}</p>}<div className="tags">{[detail.type,detail.arena,...detail.traits,...detail.keywords].filter(Boolean).map((x,i)=><span key={x+i}>{x}</span>)}</div><hr/><h3>In decks</h3>{membership(detail)}{listButton(detail)}<hr/><h3>In your collection</h3>{collectionQuantities(detail)}<small className="muted">Counts include rows mapped to this printing. Removing copies uses directly collected copies first, then mapped copies. All equivalent copies are available for deck building.</small>{active&&deckView!=='guided'&&<button className="primary full" onClick={()=>{add(detail);setNotice(detail.name+' added to '+active.name)}}><Plus size={16}/>{detail.type==='Leader'?'Use as leader':detail.type==='Base'?'Use as base':'Add to '+(section==='deck'?'main deck':'sideboard')}</button>}<p className="credit">Art by {detail.artist} · {detail.rarity}</p></div></section></Modal>}
 {collectionCard&&<Modal label="Collection quantities" onDismiss={()=>setCollectionCard(null)}><section className="modal">
  <button className="close" aria-label="Close collection quantities" onClick={()=>setCollectionCard(null)}><X/></button>
  <h2>Collection quantities</h2><p>{label(collectionCard)} · {collectionCard.id}</p>
  <p>Use + or − to change the number of copies you own for this printing.</p>
  {collectionQuantities(collectionCard)}
 </section></Modal>}
 {massEntry&&<Modal label="TCGplayer Mass Entry" onDismiss={()=>setMassEntry(null)}><section className="modal">
  <button className="close" aria-label="Close Mass Entry" onClick={()=>setMassEntry(null)}><X/></button>
  <h2>TCGplayer Mass Entry</h2>
  <p>Copy into TCGplayer Mass Entry with Star Wars: Unlimited selected. Each card starts at 1. Edit quantities here before copying.</p>
  {massEntry.unmatched.length>0&&<p className="warning">Skipped IDs without a catalog match: {massEntry.unmatched.join(', ')}</p>}
  {massEntry.copyError&&<p className="warning" role="alert">Clipboard unavailable. Select and copy the text manually or download the TXT file.</p>}
  <label>Mass Entry text<textarea rows={10} value={massEntry.text} onChange={e=>setMassEntry({...massEntry,text:e.target.value})}/></label>
  <div className="actions">
   <button className="primary" disabled={!massEntry.text.trim()} onClick={async()=>{
    try{await nativeCall('copy',{text:massEntry.text});setMassEntry(null);setNotice('TCGplayer Mass Entry text copied.')}
    catch{setMassEntry(entry=>entry?{...entry,copyError:true}:entry)}
   }}><Copy size={15}/>Copy text</button>
   <button disabled={!massEntry.text.trim()} onClick={()=>void download((massEntry.name.replace(/[^a-z0-9-]+/gi,'_').slice(0,100)||'Card_List')+'_TCGplayer.txt',massEntry.text)}><Download size={15}/>Download TXT</button>
  </div>
 </section></Modal>}
 {syncOpen&&<Modal label="Sync and card updates" onDismiss={closeSyncDialog}><section className="modal sync-dialog">
  <button className="close" aria-label="Close sync settings" onClick={closeSyncDialog}><X/></button>
  <div className="eyebrow">YOUR DEVICES, IN STEP</div><h2>Sync & card updates</h2>
  <p>Each person should create a separate account and collection. Use the same username and password only on that person’s devices; the app remembers each device’s sign-in. Account creation requires an invite code from the app owner.</p>
  <label>Sync server URL<input type="url" required placeholder="https://holocron.example.com" value={syncUrl} onChange={event=>setSyncUrl(event.target.value)} disabled={syncBusy||!!syncToken}/></label>
  {syncToken?<><p>Connected to your collection{syncAccountUsername?` as ${syncAccountUsername}`:''}.</p>
  <label className="checkbox"><input type="checkbox" checked={autoSync} onChange={event=>changeAutoSync(event.target.checked)}/> Automatically sync on startup and after local changes</label>
  <p className="muted">Auto-sync checks for conflicts before replacing either copy. If offline or a sync fails, use Sync workspace to retry.</p>
  {!syncAccountLoaded?<p className="muted">Checking your account…</p>:syncAccountUsername?<p className="muted">Use this username and password to sign in on your other devices. Your password is not stored in the app.</p>:<form onSubmit={event=>{event.preventDefault();void addSyncAccountCredentials()}}>
   <p>Set a username and password for this collection. Your existing collection stays connected. Use the invite code supplied by the app owner.</p>
   <label>Username<input required value={syncUsername} maxLength={32} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={event=>setSyncUsername(event.target.value)} disabled={syncBusy}/></label>
   <label>Password<input required type="password" value={syncPassword} minLength={8} maxLength={128} autoComplete="new-password" onChange={event=>setSyncPassword(event.target.value)} disabled={syncBusy}/></label>
   <label>Confirm password<input required type="password" value={syncPasswordConfirm} maxLength={128} autoComplete="new-password" onChange={event=>setSyncPasswordConfirm(event.target.value)} disabled={syncBusy}/></label>
   <label>Invite code<input required type="password" value={syncInviteCode} maxLength={256} autoComplete="off" onChange={event=>setSyncInviteCode(event.target.value)} disabled={syncBusy}/></label>
   <p className="muted">Username: 3–32 letters, numbers, periods, underscores, or hyphens. Password: 8–128 characters. Keep it in a password manager; there is no email-based recovery.</p>
   <button type="submit" className="primary full" disabled={syncBusy||!syncUsername.trim()||syncPassword.length<8||syncPassword!==syncPasswordConfirm||!syncInviteCode.trim()}>Save login for this collection</button>
  </form>}
  <div className="actions">
   <button className="primary" disabled={syncBusy||!loaded||!!pending.current||saving.current} onClick={()=>void syncWorkspace()}><RotateCw size={15}/>{syncBusy?'Working…':'Sync workspace'}</button>
   <button disabled={syncBusy} onClick={()=>{if(confirm('Sign out every device on this account, including this one?'))void signOutAllSync()}}>Sign out all devices</button>
   <button disabled={syncBusy} onClick={()=>void signOutSync()}>Sign out</button>
  </div></>:<>
   <form onSubmit={event=>{event.preventDefault();void syncAccount(syncAuthMode)}}>
    <label>Username<input required value={syncUsername} maxLength={32} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={event=>setSyncUsername(event.target.value)} disabled={syncBusy}/></label>
    <label>Password<input required type="password" value={syncPassword} maxLength={128} autoComplete={syncAuthMode==='register'?'new-password':'current-password'} onChange={event=>setSyncPassword(event.target.value)} disabled={syncBusy}/></label>
    {syncAuthMode==='register'&&<><label>Confirm password<input required type="password" value={syncPasswordConfirm} maxLength={128} autoComplete="new-password" onChange={event=>setSyncPasswordConfirm(event.target.value)} disabled={syncBusy}/></label><label>Invite code<input required type="password" value={syncInviteCode} maxLength={256} autoComplete="off" onChange={event=>setSyncInviteCode(event.target.value)} disabled={syncBusy}/></label><p className="muted">Username: 3–32 letters, numbers, periods, underscores, or hyphens. Password: 8–128 characters. Keep it in a password manager; there is no email-based recovery.</p></>}
    <div className="actions">
     <button type="submit" className="primary" disabled={syncBusy||!syncUsername.trim()||!syncPassword||syncAuthMode==='register'&&(syncPassword.length<8||syncPassword!==syncPasswordConfirm||!syncInviteCode.trim())}>{syncAuthMode==='login'?'Sign in':'Create account'}</button>
     <button type="button" disabled={syncBusy} onClick={()=>{setSyncAuthMode(syncAuthMode==='login'?'register':'login');setSyncPasswordConfirm('');setSyncMessage('')}}>{syncAuthMode==='login'?'Create a new account':'I already have an account'}</button>
    </div>
   </form>
  </>}
  <div className="sync-maintenance">
   <h3>Backup & card data</h3>
   <p>Last backup export: {elapsedBackup(lastBackup,backupClock)}{lastBackup?` (${new Date(lastBackup).toLocaleString()})`:''}. Backups are separate from sync and are stored wherever you save the file.</p>
   <button disabled={!loaded} onClick={()=>void backup()}><Download size={15}/>Backup workspace</button>
   <p>Card data updated: {catalog&&Number.isFinite(Date.parse(catalog.updated))?new Date(catalog.updated).toLocaleString():'Unknown'}.</p>
   <button disabled={syncBusy||!syncUrl.trim()} onClick={()=>void refreshCardCatalog()}>Get latest card info</button>
   {catalogChanges.length>0&&<details><summary>Updated cards in {catalogChanges.length} saved {catalogChanges.length===1?'deck':'decks'}</summary><ul>{catalogChanges.map(item=><li key={item.deckId}>{item.name}: {item.changed.map(id=>`${byId.get(id)?.name??id} (${id})`).join(', ')}</li>)}</ul><p>Review these cards and current format rules before playing. This comparison lasts until the next refresh or page reload.</p></details>}
  </div>
  {remoteConflict&&<div className="sync-conflict" role="alert">
   <strong>These workspaces differ.</strong><p>Cloud revision {remoteConflict.revision}, saved {new Date(remoteConflict.updatedAt).toLocaleString()}. Choose one copy; the other will be replaced. Back up this device first if needed.</p>
   <div className="actions">
    <button disabled={syncBusy||pending.current!==null||saving.current} onClick={()=>{if(confirm('Replace this device’s workspace with the cloud copy? Export a backup first if you need to keep these local changes.'))void resolveWorkspaceConflict('cloud')}}>Use cloud copy on this device</button>
    <button className="danger" disabled={syncBusy||pending.current!==null||saving.current} onClick={()=>{if(confirm('Replace the cloud workspace with this device’s copy? This affects every device on your account.'))void resolveWorkspaceConflict('device')}}>Replace cloud with this device</button>
   </div>
  </div>}
  {syncMessage&&<p className={syncMessage.includes('differs')||syncMessage.includes('Unable')||syncMessage.includes('disabled on this server')?'warning':'muted'} role="status">{syncMessage}</p>}
  <p className="muted">Use HTTPS except for a sync server running on this device. Export a backup before resolving a workspace conflict.</p>
 </section></Modal>}
 {forceMatch&&forceMatchOpen&&<RecordMatch record={forceMatch} byId={byId} external onSave={match=>{if(!recordMatch(match))return false;try{sessionStorage.removeItem('holocron-force-match')}catch{setError('Result saved, but the pending game could not be cleared from this session.')}forceMatchPending.current=false;setForceMatch(null);setNotice('ForceTable result saved to match history.');return true}} onClose={()=>setForceMatchOpen(false)} onDiscard={()=>{if(!confirm('Discard this unrecorded game?'))return;try{sessionStorage.removeItem('holocron-force-match');forceMatchPending.current=false;setForceMatch(null);setForceMatchOpen(false)}catch{setError('Unable to discard the pending game from this session.')}}}/>}
 {listCard&&<Modal label="Add card to lists" onDismiss={()=>setListCard(null)}><section className="modal"><button className="close" aria-label="Close lists" onClick={()=>setListCard(null)}><X/></button><h2>Add to lists</h2><p>{label(listCard)}</p><div className="list-choices">{lists.map(l=><label className="checkbox" key={l.uid}><input type="checkbox" checked={l.cards.includes(listCard.id)} onChange={()=>update({...current.current,lists:lists.map(x=>x.uid===l.uid?{...x,cards:x.cards.includes(listCard.id)?x.cards.filter(id=>id!==listCard.id):[...x.cards,listCard.id]}:x)})}/>{l.name}</label>)}</div><label>New list name<input value={listName} maxLength={200} onChange={e=>setListName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createList()}/></label><button className="primary full" disabled={!listName.trim()} onClick={createList}>Create list and add card</button></section></Modal>}
 {starterPickerOpen&&<StarterDeckPicker initialId={starterInitialId} byId={byId} decks={workspace.decks} onImport={importStarter} onClose={()=>setStarterPickerOpen(false)}/>}
 {historyOpen&&<Modal label="Change history" onDismiss={()=>setHistoryOpen(false)}><section className="modal history-modal"><div className="section-line"><h2>Change history</h2><button onClick={()=>setHistoryOpen(false)}>Close</button></div><p>Recent changes on this device. Restore a point to undo changes; your current state becomes a new restore point. Full backups remain the safest long-term copy.</p>{historyItems.map((item,index)=><div className="text-row" key={item.at+index}><span><strong>{item.label}</strong><small>{new Date(item.at).toLocaleString()}</small></span><button onClick={()=>{restoreHistory(index);setHistoryOpen(false)}}>Restore</button></div>)}</section></Modal>}
 {modal&&<Modal label={modal==='import'?'Import cards and decks':modal==='new'?'New deck':'Delete deck'} onDismiss={()=>setModal('')}><section className="modal" aria-label={modal==='import'?'Import cards and decks':modal==='new'?'New deck':'Delete deck'} onClick={e=>e.stopPropagation()}><button className="close" aria-label="Close dialog" onClick={()=>setModal('')}><X/></button>{modal==='new'?<><div className="eyebrow">A NEW GAME PLAN</div><h2>Build your next deck</h2><p>Start with a name. Pick your leader and base in the builder.</p><label>Deck name<input autoFocus value={editName} maxLength={200} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&newDeck()} placeholder="e.g. Wedge · Squadron command"/></label><button className="primary full" disabled={!loaded} onClick={newDeck}><Plus size={16}/>Create deck</button></>:modal==='delete'?<><h2>Delete this deck?</h2><p>“{deckToDelete?.name}” will be removed. Your collection won’t change.</p><div className="actions"><button onClick={()=>setModal('')}>Cancel</button><button className="danger" disabled={!deckToDelete||!loaded} onClick={deleteDeck}>Delete deck</button></div></>:<><div className="eyebrow">BRING YOUR CARDS HOME</div><h2>Import into Holocron</h2><p>Your existing collection and deck files work here.</p><div className="import-tabs">{[['collection','Collection CSV'],['deck','Deck JSON'],['backup','Full backup']].map(([v,l])=><button className={importType===v?'active':''} key={v} onClick={()=>{setImportType(v);resetImportPreview();setImportText('');setNotice('')}}>{l}</button>)}</div><label className="file-drop"><Upload size={25}/><strong>Choose a {importType==='collection'?'CSV':'JSON'} file</strong><span>or paste the contents below</span><input type="file" accept={importType==='collection'?'.csv,text/csv':'.json,application/json'} onChange={async e=>{const f=e.target.files?.[0];if(f){resetImportPreview();if(f.size>5000000){setNotice('File must be under 5 MB');return}setImportText(await f.text())}}}/></label><textarea aria-label="Import contents" rows={5} value={importText} onChange={e=>{setImportText(e.target.value);resetImportPreview()}} placeholder={importType==='collection'?'Set,CardNumber,Count,IsFoil\nSOR,005,1,FALSE':'Paste JSON here…'}/>{importType==='collection'&&<div className="import-mode"><label><input type="radio" name="mode" checked={importMode==='add'} onChange={()=>{setImportMode('add');setImportConfirmed(false)}}/>Add these quantities (default)</label><label><input type="radio" name="mode" checked={importMode==='replace'} onChange={()=>{setImportMode('replace');setImportConfirmed(false)}}/>Replace collection</label></div>}<p className="muted">{importType==='collection'?'SWUDB → My collection → Bulk actions → CSV export. Add increases your existing counts, including when you import the same file again. Replace sets your collection to the file.':importType==='deck'?'Uses SWUDB’s native JSON schema. Importing a deck never adds cards to your collection.':'Choose your Holocron backup from Files or iCloud Drive. Restoring replaces your collection, decks, lists, and favorites, including foil quantities and deck notes. Save a current backup first.'}</p>{notice&&<p className="warning">{notice}</p>}{preview&&<div className="import-preview"><CheckCircle2 size={20}/><div><strong>{importType==='collection'?`${count(preview.data.collection).toLocaleString()} cards across ${preview.data.collection.length} rows`:importType==='deck'?`${preview.data.name} · ${count(preview.data.deck)} main deck cards`:`${preview.data.decks.length} decks and ${count(preview.data.collection)} cards`}</strong><p>{preview.unknown.length?`${preview.unknown.length} unknown IDs will be preserved: ${preview.unknown.slice(0,8).join(', ')}`:'All checked card IDs found in the catalog.'}</p></div></div>}{preview&&<label className="import-confirmation"><input type="checkbox" checked={importConfirmed} onChange={e=>setImportConfirmed(e.target.checked)}/><span>I reviewed the preview and accept: {importConfirmationText()}</span></label>}<button className="primary full" disabled={!loaded||!importText.trim()||!!preview&&!importConfirmed} onClick={preview?applyImport:validateImport}>{preview?importActionLabel():'Preview import'}<ArrowUpRight size={16}/></button></>}</section></Modal>}
 </div></HighlightProvider></CardValueProvider>
}
