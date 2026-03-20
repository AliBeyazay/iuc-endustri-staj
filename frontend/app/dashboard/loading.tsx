// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="h-12 bg-[#1E3A5F]" />
      <div className="max-w-5xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 animate-pulse">
        <div className="space-y-4">
          {/* Welcome skeleton */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="h-5 bg-gray-100 rounded w-48 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-32 mb-4" />
            <div className="grid grid-cols-4 gap-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <div className="h-8 bg-gray-100 rounded w-10 mx-auto mb-1" />
                  <div className="h-2 bg-gray-100 rounded w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          {/* Bookmarks skeleton */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="h-4 bg-gray-100 rounded w-40 mb-4" />
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 mb-1.5">
                <div className="w-8 h-8 bg-gray-100 rounded-md shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-100 rounded w-3/4 mb-1" />
                  <div className="h-2 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Sidebar skeleton */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="w-11 h-11 rounded-full bg-gray-100 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-32 mb-1" />
            <div className="h-3 bg-gray-100 rounded w-44 mb-4" />
            <div className="h-2 bg-gray-100 rounded-full mb-2" />
            <div className="h-2 bg-gray-100 rounded w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
