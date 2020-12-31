// 当前的fiber
const fiber = {
  memoizedState: null,
  stateNode: App,
};

// 工作进行中的hook，就是当前在用的hook
let workInProgressHook = null;
// 简单模拟是否在挂载
let isMount = true;

// 简单模拟调度
function schedule() {
  workInProgressHook = fiber.memoizedState;

  const app = fiber.stateNode();

  isMount = false;

  return app;
}

let timer;
function dispatchAction(queue, action) {
  // 更新
  const update = {
    action,
    next: null,
  };

  // 环形链表，保证链头为最新更新更新
  if (queue.pending === null) {
    update.next = update;
  } else {
    update.next = queue.pending.next;
    queue.pending.next = update;
  }

  queue.pending = update;

  // 实现异步更新
  clearTimeout(timer);
  timer = setTimeout(() => {
    schedule();
  }, 1);
}

function useState(initialState) {
  let hook;

  if (isMount) {
    // 挂载时的操作
    hook = {
      queue: {
        pending: null,
      },
      memoizedState: initialState,
      next: null,
    };

    if (!fiber.memoizedState) {
      // 没值把第一个hook挂载在fiber.memoizedState上
      fiber.memoizedState = hook;
    } else {
      // 有，把hook挂载在fiber.memoizedState的下个节点上
      workInProgressHook.next = hook;
    }
    // 更新为当前hook
    workInProgressHook = hook;
  } else {
    // 更新时获取当前第一个hook
    hook = workInProgressHook;

    // 指向下一个hook
    workInProgressHook = workInProgressHook.next;
  }

  // 获取当前的state
  let baseState = hook.memoizedState;

  if (hook.queue.pending) {
    // 存在需要更新的状态
    let firstUpdate = hook.queue.pending.next;

    // 遍历环形链表 第一个等于当前时为终结循环
    do {
      const action = firstUpdate.action;
      // 获取最新状态
      baseState = action(baseState);
      firstUpdate = firstUpdate.next;
    } while (firstUpdate !== hook.queue.pending);
    // 清除更新队列
    hook.queue.pending = null;
  }

  // 保存当前最新状态到state里
  hook.memoizedState = baseState;

  return [baseState, dispatchAction.bind(null, hook.queue)];
}

function App() {
  const [num, updateNum] = useState(0);
  const [num1, updateNum1] = useState(100);

  console.log(`${isMount ? "mount" : "update"} num: `, num);
  console.log(`${isMount ? "mount" : "update"} num1: `, num1);

  return {
    click() {
      updateNum((num) => num + 1);
      updateNum((num) => num + 2);
      updateNum((num) => num + 3);
    },
    focus() {
      updateNum1((num) => num + 3);
    },
  };
}

window.run = schedule();
