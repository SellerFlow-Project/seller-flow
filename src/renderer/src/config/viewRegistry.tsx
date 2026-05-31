import type { ReactNode } from 'react'
import { AIFunctions } from '../views/AIFunctions'
import { AmazonCollection } from '../views/AmazonCollection'
import { DashboardView } from '../views/DashboardView'
import { DataBrowsing } from '../views/DataBrowsing'
import { DataDeletion } from '../views/DataDeletion'
import { SellerSprite } from '../views/SellerSprite'
import { SettingsView } from '../views/SettingsView'
import type { TabKey } from './tabs'

export const TAB_VIEWS: Record<TabKey, ReactNode> = {
  dashboard: <DashboardView />,
  'amazon-collection': <AmazonCollection />,
  'data-browsing': <DataBrowsing />,
  'data-deletion': <DataDeletion />,
  'ai-functions': <AIFunctions />,
  'seller-sprite': <SellerSprite />,
  settings: <SettingsView />
}
