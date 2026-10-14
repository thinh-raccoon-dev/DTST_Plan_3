import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, toApiError } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import type { DestinationSummary } from '../types/api';

/** Favorite state for one destination; guests are sent to the login page. */
export function useFavorite(destinationId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !destinationId) {
      setFavorited(false);
      return;
    }
    let cancelled = false;
    api
      .get<{ items: DestinationSummary[] }>('/favorites')
      .then((res) => {
        if (!cancelled) setFavorited(res.data.items.some((d) => d.id === destinationId));
      })
      .catch(() => {
        // The button stays usable; a failed status lookup only affects the initial icon.
      });
    return () => {
      cancelled = true;
    };
  }, [user, destinationId]);

  const toggle = useCallback(async () => {
    if (!destinationId) return;
    if (!user) {
      toast.info('Đăng nhập để lưu địa điểm yêu thích');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    try {
      if (favorited) {
        await api.delete(`/favorites/${destinationId}`);
        setFavorited(false);
        toast.success('Đã bỏ khỏi danh sách yêu thích');
      } else {
        await api.post(`/favorites/${destinationId}`);
        setFavorited(true);
        toast.success('Đã lưu vào yêu thích');
      }
    } catch (error) {
      toast.error('Không cập nhật được yêu thích', toApiError(error).message);
    } finally {
      setBusy(false);
    }
  }, [destinationId, favorited, user, navigate, location.pathname]);

  return { favorited, busy, toggle };
}
