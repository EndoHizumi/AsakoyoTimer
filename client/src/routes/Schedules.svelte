<script>
  import { onMount } from 'svelte';
  import { scheduleApi, youtubeApi, favoritesApi } from '../stores/api.js';

  let schedules = [];
  let isEditing = false;
  let editingSchedule = null;
  let loading = true;
  let error = null;
  let channelSearchResults = [];
  let searchQuery = '';
  let isSearching = false;
  let favoriteChannels = [];
  let recentChannels = [];
  let showingTab = 'favorites'; // 'favorites', 'recent', 'search'

  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

  onMount(async () => {
    await loadSchedules();
    await loadFavoriteChannels();
    await loadRecentChannels();
  });

  async function loadSchedules() {
    try {
      schedules = await scheduleApi.getAll();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadFavoriteChannels() {
    try {
      favoriteChannels = await favoritesApi.getAll();
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  }

  async function loadRecentChannels() {
    try {
      recentChannels = await favoritesApi.getRecent();
    } catch (err) {
      console.error('Failed to load recent channels:', err);
    }
  }

  async function searchChannels() {
    if (!searchQuery.trim()) return;
    
    isSearching = true;
    try {
      channelSearchResults = await youtubeApi.searchChannels(searchQuery);
    } catch (err) {
      error = err.message;
    } finally {
      isSearching = false;
    }
  }

  function selectChannel(channel) {
    editingSchedule = {
      ...editingSchedule,
      channel_id: channel.channelId || channel.channel_id,
      channel_name: channel.name || channel.channel_name
    };
    channelSearchResults = [];
    searchQuery = '';
    showingTab = 'favorites';
  }

  async function addToFavorites(channel) {
    try {
      await favoritesApi.add({
        channel_id: channel.channelId,
        channel_name: channel.name,
        thumbnail: channel.thumbnail,
        description: channel.description
      });
      await loadFavoriteChannels();
    } catch (err) {
      error = err.message;
    }
  }

  async function removeFromFavorites(channelId) {
    try {
      await favoritesApi.remove(channelId);
      await loadFavoriteChannels();
    } catch (err) {
      error = err.message;
    }
  }

  async function saveSchedule() {
    try {
      if (editingSchedule.id) {
        await scheduleApi.update(editingSchedule.id, editingSchedule);
      } else {
        await scheduleApi.create(editingSchedule);
      }
      
      await loadSchedules();
      cancelEdit();
    } catch (err) {
      error = err.message;
    }
  }

  async function deleteSchedule(id) {
    if (confirm('このスケジュールを削除しますか？')) {
      try {
        await scheduleApi.delete(id);
        await loadSchedules();
      } catch (err) {
        error = err.message;
      }
    }
  }

  function editSchedule(schedule) {
    editingSchedule = { ...schedule };
    isEditing = true;
  }

  function addSchedule() {
    editingSchedule = {
      channel_id: '',
      channel_name: '',
      day_of_week: 1,
      start_time: '09:00',
      duration_minutes: 120,
      device_id: null,
      is_active: true
    };
    isEditing = true;
  }

  function cancelEdit() {
    isEditing = false;
    editingSchedule = null;
    channelSearchResults = [];
    searchQuery = '';
  }
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-100 transition-colors duration-200" style="font-weight: 500;">配信スケジュール管理</h1>
    <button
      on:click={addSchedule}
      class="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm flex items-center"
      style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
    >
      <span class="material-icons mr-2 text-sm">add</span>
      新規作成
    </button>
  </div>

  {#if error}
    <div class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 rounded-md p-4 transition-colors duration-200" style="box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div class="flex">
        <span class="material-icons text-red-400 dark:text-red-300 mr-3">error</span>
        <p class="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    </div>
  {/if}

  {#if isEditing}
    <!-- スケジュール編集フォーム -->
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors duration-200" style="box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <div class="flex items-center mb-6">
        <span class="material-icons text-blue-600 dark:text-blue-400 mr-3">edit</span>
        <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          {editingSchedule.id ? 'スケジュール編集' : '新規スケジュール作成'}
        </h2>
      </div>
      
      <form on:submit|preventDefault={saveSchedule} class="space-y-4">
        <!-- チャンネル選択 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">チャンネル</label>
          
          {#if editingSchedule.channel_name}
            <div class="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <div class="text-sm text-green-800">
                選択中: <strong>{editingSchedule.channel_name}</strong>
              </div>
              <button
                type="button"
                on:click={() => {editingSchedule.channel_id = ''; editingSchedule.channel_name = '';}}
                class="mt-1 text-xs text-green-600 hover:text-green-800"
              >
                選択を解除
              </button>
            </div>
          {/if}

          <!-- タブ -->
          <div class="flex space-x-1 mb-3">
            <button
              type="button"
              on:click={() => showingTab = 'favorites'}
              class="px-3 py-1 text-sm rounded-md transition-colors
                {showingTab === 'favorites' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
            >
              お気に入り ({favoriteChannels.length})
            </button>
            <button
              type="button"
              on:click={() => showingTab = 'recent'}
              class="px-3 py-1 text-sm rounded-md transition-colors
                {showingTab === 'recent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
            >
              最近使用 ({recentChannels.length})
            </button>
            <button
              type="button"
              on:click={() => showingTab = 'search'}
              class="px-3 py-1 text-sm rounded-md transition-colors
                {showingTab === 'search' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
            >
              検索
            </button>
          </div>

          <!-- お気に入りチャンネル -->
          {#if showingTab === 'favorites'}
            <div class="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
              {#if favoriteChannels.length === 0}
                <div class="p-4 text-center text-gray-500 text-sm">
                  お気に入りチャンネルがありません
                </div>
              {/if}
              {#each favoriteChannels as channel}
                <div class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                  <button
                    type="button"
                    on:click={() => selectChannel(channel)}
                    class="flex items-center space-x-3 flex-1 text-left"
                  >
                    <img src={channel.thumbnail || '/default-avatar.png'} alt="" class="w-8 h-8 rounded-full" />
                    <div>
                      <div class="font-medium text-sm">{channel.channel_name}</div>
                      <div class="text-xs text-gray-500 truncate max-w-xs">{channel.description || ''}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    on:click={() => removeFromFavorites(channel.channel_id)}
                    class="ml-2 text-red-500 hover:text-red-700 text-xs"
                    title="お気に入りから削除"
                  >
                    ❌
                  </button>
                </div>
              {/each}
            </div>
          {/if}

          <!-- 最近使用したチャンネル -->
          {#if showingTab === 'recent'}
            <div class="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
              {#if recentChannels.length === 0}
                <div class="p-4 text-center text-gray-500 text-sm">
                  最近使用したチャンネルがありません
                </div>
              {/if}
              {#each recentChannels as channel}
                <button
                  type="button"
                  on:click={() => selectChannel(channel)}
                  class="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span class="text-xs text-gray-600">📺</span>
                    </div>
                    <div>
                      <div class="font-medium text-sm">{channel.channel_name}</div>
                      <div class="text-xs text-gray-500">最終使用: {new Date(channel.last_used).toLocaleDateString('ja-JP')}</div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}

          <!-- チャンネル検索 -->
          {#if showingTab === 'search'}
            <div class="space-y-2">
              <div class="flex space-x-2">
                <input
                  type="text"
                  bind:value={searchQuery}
                  placeholder="チャンネル名で検索..."
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  on:click={searchChannels}
                  disabled={isSearching || !searchQuery.trim()}
                  class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50"
                >
                  {isSearching ? '検索中...' : '検索'}
                </button>
              </div>
              
              {#if channelSearchResults.length > 0}
                <div class="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                  {#each channelSearchResults as channel}
                    <div class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                      <button
                        type="button"
                        on:click={() => selectChannel(channel)}
                        class="flex items-center space-x-3 flex-1 text-left"
                      >
                        <img src={channel.thumbnail} alt="" class="w-8 h-8 rounded-full" />
                        <div>
                          <div class="font-medium text-sm">{channel.name}</div>
                          <div class="text-xs text-gray-500 truncate max-w-xs">{channel.description}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        on:click={() => addToFavorites(channel)}
                        class="ml-2 text-yellow-500 hover:text-yellow-700 text-xs"
                        title="お気に入りに追加"
                      >
                        ⭐
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">曜日</label>
            <select
              bind:value={editingSchedule.day_of_week}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {#each dayNames as day, index}
                <option value={index}>{day}</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">開始時刻</label>
            <input
              type="time"
              bind:value={editingSchedule.start_time}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">配信時間（分）</label>
          <input
            type="number"
            bind:value={editingSchedule.duration_minutes}
            min="1"
            max="480"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="flex items-center">
          <input
            type="checkbox"
            bind:checked={editingSchedule.is_active}
            id="is_active"
            class="mr-2"
          />
          <label for="is_active" class="text-sm font-medium text-gray-700">有効</label>
        </div>

        <div class="flex space-x-2">
          <button
            type="submit"
            disabled={!editingSchedule.channel_id || !editingSchedule.channel_name}
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            保存
          </button>
          <button
            type="button"
            on:click={cancelEdit}
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  {:else}
    <!-- スケジュール一覧 -->
    <div class="bg-white rounded-lg shadow">
      {#if loading}
        <div class="p-6">
          <div class="animate-pulse space-y-4">
            {#each Array(3) as _}
              <div class="h-16 bg-gray-200 rounded"></div>
            {/each}
          </div>
        </div>
      {:else if schedules.length === 0}
        <div class="p-6 text-center text-gray-500">
          スケジュールが登録されていません
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  チャンネル
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  曜日・時刻
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  配信時間
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状態
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each schedules as schedule}
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{schedule.channel_name}</div>
                    <div class="text-sm text-gray-500 truncate">{schedule.channel_id}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {dayNames[schedule.day_of_week]} {schedule.start_time}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {schedule.duration_minutes}分
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full
                      {schedule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                      {schedule.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      on:click={() => editSchedule(schedule)}
                      class="text-blue-600 hover:text-blue-900"
                    >
                      編集
                    </button>
                    <button
                      on:click={() => deleteSchedule(schedule.id)}
                      class="text-red-600 hover:text-red-900"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>