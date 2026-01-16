import { useEffect } from "react";
import { useNormalGameStore } from "../stores/normalGameStore";
import { useHardModeStore } from "../stores/hardModeStore";

export function useMigration() {
  useEffect(() => {
    const normalStore = useNormalGameStore.getState();
    const hardStore = useHardModeStore.getState();

    console.log('App mounted: Checking for old data to migrate...');

    normalStore.migrateFromOldFormat();
    hardStore.migrateFromOldFormat();

    console.log('Migration check complete');
  }, []);
}

export default useMigration;
