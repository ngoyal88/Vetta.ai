export function queryLoadState(isLoading: boolean, isFetching: boolean, hasData: boolean) {
  return {
    showSkeleton: isLoading && !hasData,
    showRefreshing: isFetching && hasData,
    isReady: hasData || !isLoading,
  };
}
