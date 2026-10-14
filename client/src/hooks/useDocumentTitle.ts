import { useEffect } from 'react';

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Hộ chiếu Trải nghiệm Đồng Tháp` : 'Hộ chiếu Trải nghiệm Đồng Tháp';
  }, [title]);
}
