import { useState } from 'react';

export interface UseActivityDeleteOptions {
  onDeleted?: (rideId: string) => void;
}

export function useActivityDelete({ onDeleted }: UseActivityDeleteOptions = {}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const requestDelete = (e: React.MouseEvent, rideId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteError(null);
    setDeleteConfirmDialog({ id: rideId, title });
  };

  const cancelDelete = () => {
    setDeleteConfirmDialog(null);
    setDeleteError(null);
  };

  const executeDelete = async () => {
    if (!deleteConfirmDialog) return;
    const { id: rideId } = deleteConfirmDialog;
    setDeletingId(rideId);
    setDeleteError(null);
    try {
      const { deleteRide } = await import('../services/rideService');
      const { deleteLocalRide } = await import('../utils/storage/indexedDb');
      await deleteRide(rideId);
      await deleteLocalRide(rideId);
      onDeleted?.(rideId);
      setDeleteConfirmDialog(null);
    } catch (err: any) {
      setDeleteError(err.message || '网络错误，删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return {
    deletingId,
    deleteConfirmDialog,
    deleteError,
    requestDelete,
    cancelDelete,
    executeDelete,
  };
}
