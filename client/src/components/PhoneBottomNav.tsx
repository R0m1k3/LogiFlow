import { Home, Package, Truck, ClipboardList, MoreHorizontal } from "lucide-react"
import { Link, useLocation } from "wouter"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { User } from "@shared/schema"

interface NavItem {
  path: string
  label: string
  icon: any
  primary?: boolean
}

interface MoreMenuItem {
  path: string
  label: string
  icon: any
  roles?: string[]
}

const primaryNavItems: NavItem[] = [
  { path: "/", label: "Accueil", icon: Home, primary: true },
  { path: "/orders", label: "Commandes", icon: Package, primary: true },
  { path: "/deliveries", label: "Livraisons", icon: Truck, primary: true },
  { path: "/tasks", label: "Tâches", icon: ClipboardList, primary: true },
]

const moreMenuItems: MoreMenuItem[] = [
  { path: "/bl-reconciliation", label: "Rapprochement", icon: ClipboardList, roles: ["admin", "directeur", "manager"] },
  { path: "/publicities", label: "Publicités", icon: Package, roles: ["admin", "directeur", "manager"] },
  { path: "/customer-orders", label: "Commandes Clients", icon: Package, roles: ["admin", "directeur", "manager"] },
  { path: "/avoirs", label: "Avoirs", icon: Package, roles: ["admin", "directeur", "manager"] },
  { path: "/dlc", label: "DLC", icon: Package, roles: ["admin", "directeur", "manager"] },
  { path: "/sav", label: "SAV", icon: ClipboardList, roles: ["admin", "directeur", "manager"] },
  { path: "/calendar", label: "Calendrier", icon: ClipboardList },
]

interface PhoneBottomNavProps {
  user: User
  location: string
}

export default function PhoneBottomNav({ user, location }: PhoneBottomNavProps) {
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === "/") return location === "/"
    return location.startsWith(path)
  }

  const hasPermission = (roles?: string[]) => {
    if (!roles || !user) return true
    return roles.includes(user.role)
  }

  const filteredMoreItems = moreMenuItems.filter(item => hasPermission(item.roles))

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb bottom-nav">
      <div className="flex items-center justify-around py-2 px-1">
        {/* Navigation principale */}
        {primaryNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex flex-col items-center justify-center min-w-[60px] py-2 px-1 rounded-lg transition-all duration-200 ${
                  active 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                data-testid={`nav-${item.path.replace('/', 'home')}`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-600'}`} />
                <span className={`text-xs mt-1 font-medium ${
                  active ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {item.label}
                </span>
              </div>
            </Link>
          )
        })}

        {/* Menu "Plus" */}
        <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
          <SheetTrigger asChild>
            <div
              className="flex flex-col items-center justify-center min-w-[60px] py-2 px-1 rounded-lg transition-all duration-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
              data-testid="nav-more"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-600" />
              <span className="text-xs mt-1 font-medium text-gray-600">Plus</span>
            </div>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-lg">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>
                Accédez aux autres sections de l'application
              </SheetDescription>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4 mt-6 pb-4">
              {filteredMoreItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    onClick={() => setMoreSheetOpen(false)}
                  >
                    <div
                      className={`flex flex-col items-center justify-center p-4 rounded-lg transition-all duration-200 min-h-[80px] ${
                        active 
                          ? 'bg-blue-50 text-blue-600 border-2 border-blue-200' 
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                      data-testid={`more-nav-${item.path.replace('/', '')}`}
                    >
                      <Icon className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-600'}`} />
                      <span className={`text-sm mt-2 font-medium text-center ${
                        active ? 'text-blue-600' : 'text-gray-700'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}