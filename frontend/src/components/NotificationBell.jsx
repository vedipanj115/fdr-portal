// Header bell: unread count and a dropdown of notifications, newest first. Clicking one marks it read.
import { useEffect, useRef, useState } from 'react';
import { getNotifications, markNotificationRead } from '../api/client';
import { useAuth } from '../auth';
import { formatDate } from '../utils/format';
import ReminderBadge from './ReminderBadge';

export default function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);

  useEffect(() => {
    getNotifications({ institutionId: user.institutionId }).then(setItems);
  }, [user.institutionId]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (!wrapper.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (n) => {
    if (n.read) return;
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await markNotificationRead(n.id);
  };

  return (
    <div ref={wrapper} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="relative rounded-md p-1.5 hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 z-20 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-gray-500">{unread} unread</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => markRead(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-gray-50 ${n.read ? '' : 'bg-navy-50/60'}`}>
                    <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-navy-600'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <ReminderBadge type={n.type} />
                        <span className="text-xs text-gray-500">{formatDate(n.at)}</span>
                        {!n.read && <span className="sr-only">Unread</span>}
                      </span>
                      <span className={`mt-1 block text-sm ${n.read ? 'text-gray-600' : 'font-medium text-gray-900'}`}>{n.message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
