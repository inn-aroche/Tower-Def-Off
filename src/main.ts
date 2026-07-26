import { AppState } from './app/AppState';
import { Router, type ScreenFactory } from './app/Router';
import type { Route } from './app/routes';
import { HubScreen } from './app/screens/HubScreen';
import { CollectionScreen } from './app/screens/CollectionScreen';
import { UnitDetailScreen } from './app/screens/UnitDetailScreen';
import { CombatScreen } from './app/screens/CombatScreen';
import { ResultsScreen } from './app/screens/ResultsScreen';
import { SurvivalScreen } from './app/screens/SurvivalScreen';
import { SurvivalResultsScreen } from './app/screens/SurvivalResultsScreen';
import { ChallengesScreen } from './app/screens/ChallengesScreen';
import { HeroScreen } from './app/screens/HeroScreen';
import { HeroDetailScreen } from './app/screens/HeroDetailScreen';
import { ArenaScreen } from './app/screens/ArenaScreen';
import { PvpCombatScreen } from './app/screens/PvpCombatScreen';
import { PvpResultsScreen } from './app/screens/PvpResultsScreen';
import { ShopScreen } from './app/screens/ShopScreen';
import { ChestScreen } from './app/screens/ChestScreen';
import { SettingsScreen } from './app/screens/SettingsScreen';
import { LocalStorageSaveProvider } from './platform/LocalStorageSave';
import { NullAdProvider, NullAnalyticsProvider, NullIapProvider } from './platform/NullProviders';
import { createDefaultSaveData, migrateSaveData, SAVE_KEY, SAVE_SCHEMA_VERSION, type SaveData } from './meta/SaveData';
import { ensureTheme } from './ui/theme';

ensureTheme();

const analytics = new NullAnalyticsProvider();
const ads = new NullAdProvider();
const iap = new NullIapProvider();

const saveProvider = new LocalStorageSaveProvider<SaveData>(SAVE_KEY, SAVE_SCHEMA_VERSION, migrateSaveData);
const save = saveProvider.load() ?? createDefaultSaveData();
const app = new AppState(save, saveProvider, analytics, ads, iap);

const host = document.getElementById('app')!;

const factories: Record<Route['name'], ScreenFactory> = {
  hub: HubScreen,
  collection: CollectionScreen,
  unit: UnitDetailScreen,
  deck: CollectionScreen, // deck + collection are now one unified screen
  combat: CombatScreen,
  results: ResultsScreen,
  survival: SurvivalScreen,
  survivalResults: SurvivalResultsScreen,
  challenges: ChallengesScreen,
  heroes: HeroScreen,
  hero: HeroDetailScreen,
  arena: ArenaScreen,
  pvp: PvpCombatScreen,
  pvpResults: PvpResultsScreen,
  shop: ShopScreen,
  chest: ChestScreen,
  settings: SettingsScreen,
};

const router = new Router(host, app, factories);
router.go({ name: 'hub' });
