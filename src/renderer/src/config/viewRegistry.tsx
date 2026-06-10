import type { ReactNode } from 'react'
import { AIFunctions } from '../views/AIFunctions'
import { AmazonCollection } from '../views/AmazonCollection'
import { AmazonSearch } from '../views/AmazonSearch'
import { DashboardView } from '../views/DashboardView'
import { DataBrowsing } from '../views/DataBrowsing'
import { DataDeletion } from '../views/DataDeletion'
import { SearchKeywordBrowsing } from '../views/SearchKeywordBrowsing'
import { SellerSprite } from '../views/SellerSprite'
import { SettingsView } from '../views/SettingsView'
import { AccountAdminView } from '../views/AccountAdminView'
import type { TabKey } from './tabs'

export const TAB_VIEWS: Record<TabKey, ReactNode> = {
  dashboard: <DashboardView />,
  'amazon-collection': <AmazonCollection />,
  'amazon-search': <AmazonSearch />,
  'data-browsing': <DataBrowsing />,
  'search-keyword-browsing': <SearchKeywordBrowsing />,
  'data-deletion': <DataDeletion />,
  'ai-functions': <AIFunctions />,
  'seller-sprite': <SellerSprite />,
  settings: <SettingsView />,
  'account-admin': <AccountAdminView />
}
