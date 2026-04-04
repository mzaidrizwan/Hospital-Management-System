import { dbManager } from "@/lib/indexedDB";

export const migratePreReceiveToQueueItems = async () => {
  const queueItems = await dbManager.getFromLocal('queue');
  const transactions = await dbManager.getFromLocal('transactions');
  
  const preReceiveTxns = transactions.filter(t => t.type === 'pre_receive');
  
  for (const txn of preReceiveTxns) {
    const queueItem = queueItems.find(q => q.id === txn.queueItemId);
    if (queueItem && !queueItem.preReceiveAmount) {
      queueItem.preReceiveAmount = txn.amount;
      await dbManager.saveToLocal('queue', queueItem);
      console.log(`Migrated pre-receive ${txn.amount} to queue item ${queueItem.id}`);
    }
  }
};