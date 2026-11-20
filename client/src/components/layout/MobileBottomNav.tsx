import clsx from 'clsx';
import { Compass, Footprints, MapPinCheck, Route, Stamp } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/destinations', label: 'Khám phá', icon: Compass },
  { to: '/itinerary/create', label: 'Lịch trình', icon: Route },
  { to: '/check-in', label: 'GPS', icon: MapPinCheck, primary: true },
  { to: '/footprints', label: 'Dấu chân', icon: Footprints },
  { to: '/passport', label: 'Hộ chiếu', icon: Stamp },
];

export function MobileBottomNav() {
  return (
    <nav
      aria-label="Điều hướng nhanh trên di động"
      className="pb-safe fixed inset-x-0 bottom-0 z-[900] border-t border-sand-200/90 bg-white/95 shadow-[0_-8px_30px_-14px_rgba(15,47,37,0.22)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid h-[4.1rem] max-w-md grid-cols-5 items-center px-1.5">
        {tabs.map(({ to, label, icon: Icon, primary }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'group relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 transition-all duration-200 active:scale-95',
                primary
                  ? ''
                  : isActive
                    ? 'text-leaf-700'
                    : 'text-river-500 hover:text-river-800',
              )
            }
          >
            {({ isActive }) =>
              primary ? (
                <div className="flex flex-col items-center">
                  <span
                    className={clsx(
                      '-mt-5 grid size-12 place-items-center rounded-2xl border-[3px] border-white shadow-lg transition-transform duration-200',
                      isActive
                        ? 'scale-105 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-600/35'
                        : 'bg-gradient-to-br from-leaf-600 to-leaf-800 text-white shadow-leaf-800/30',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span
                    className={clsx(
                      'mt-0.5 text-[10px] font-extrabold tracking-tight',
                      isActive ? 'text-emerald-700' : 'text-river-600',
                    )}
                  >
                    {label}
                  </span>
                </div>
              ) : (
                <>
                  <span
                    className={clsx(
                      'grid h-7 w-11 place-items-center rounded-full transition-colors duration-200',
                      isActive ? 'bg-leaf-100 text-leaf-800' : 'bg-transparent',
                    )}
                  >
                    <Icon className="size-[1.15rem]" aria-hidden />
                  </span>
                  <span
                    className={clsx(
                      'text-[10px] leading-none tracking-tight',
                      isActive ? 'font-extrabold text-leaf-800' : 'font-semibold',
                    )}
                  >
                    {label}
                  </span>
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
