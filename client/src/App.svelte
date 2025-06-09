<script>
  import { onMount, onDestroy } from 'svelte';
  import { currentRoute } from './stores/router.js';
  import { wsService } from './stores/websocket.js';
  import Layout from './components/Layout.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import Schedules from './routes/Schedules.svelte';
  import Devices from './routes/Devices.svelte';
  import Logs from './routes/Logs.svelte';
  import './app.css';

  let currentComponent = Dashboard;

  // ルーティング
  $: {
    switch ($currentRoute) {
      case '/':
        currentComponent = Dashboard;
        break;
      case '/schedules':
        currentComponent = Schedules;
        break;
      case '/devices':
        currentComponent = Devices;
        break;
      case '/logs':
        currentComponent = Logs;
        break;
      default:
        currentComponent = Dashboard;
        break;
    }
  }

  onMount(() => {
    // WebSocket接続を開始
    wsService.connect();

    // 定期的にpingを送信
    const pingInterval = setInterval(() => {
      wsService.ping();
    }, 30000); // 30秒間隔

    // クリーンアップ関数を返す
    return () => {
      clearInterval(pingInterval);
    };
  });

  onDestroy(() => {
    // WebSocket接続を切断
    wsService.disconnect();
  });
</script>

<Layout>
  <svelte:component this={currentComponent} />
</Layout>