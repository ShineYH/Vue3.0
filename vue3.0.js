let toProxy = new WeakMap();  // 映射关系 原对象：代理后的对象
let toRow = new WeakMap();   // 映射关系 代理后的对象：原对象

function isObject(val) {
	return typeof val === 'object' && val !== null;
}

function hasOwn(target, key) {
	return target.hasOwnProperty(key);
}

function reactive(target) {
	// 创建响应式对象
	return createReactiveObject(target);
}

function createReactiveObject(target) {
	if(!isObject(target)) { return target; } // 如果不是对象，直接返回

	let proxy = toProxy.get(target);
	if (proxy) return proxy;  // 如果已经代理过了，直接将代理结果返回

	if (toRow.has(target)) return target;  // 此时 target如果是observe，是一个已经代理过的对象，那就直接返回

	// 数据劫持
	let observed = new Proxy(target, {
		get(target, key, receiver) {
			// console.info('get');
			// console.info(key);
			let result = Reflect.get(target, key, receiver);
			// result 就是当前获取到的值，此时如果result是个对象，那对result再进行一次绑定

			// 依赖收集，将当前的属性和effect对应起来，如果这个key变化了，重新让数组中的effect执行
			track(target, key);

			return isObject(result) ? reactive(result) : result;   // 递归
		},
		set(target, key, value, receiver) {
			const hasKey = hasOwn(target, key);
			let oldValue = target[key];   // 记录老值
			// Reflect.set方法会有一个返回值，为boolean类型，告诉你这个值是否设置成功
			// console.info(target, key, value);
			let res = Reflect.set(target, key, value, receiver);
			// console.info(oldValue, value);
			if (!hasKey) { // 原有数组里面没这个属性，表示新增值
				// console.info('新增');
				trigger(target, 'add',key);
			} else if (oldValue !== value) {  // 表示修改属性
				// console.info('修改属性');
				trigger(target, 'set',key);	
			} else {
				// 无意义更新，不需要做任何处理
			}
			
			return res;	
		},
		deleteProperty(target, key) {   // 删除
			console.log('delete');
			let res = Reflect.deleteProperty(target, key);
			return res;
		}
	});
	toProxy.set(target, observed);
	toRow.set(observed, target);
	return observed;
}

let activeEffectStact = [];  // 栈
function effect(fn) {
	// 需要将fn做成响应式的，当属性变动后，就执行函数
	let effect = createReactiveEffect(fn);
	// 创建完之后，要默认执行一次
	effect(); 
}

function createReactiveEffect(fn) {
	// 创建一个响应式effect
	let effect = function() {
		// run方法有两个目的 1. 执行fn 2. 将effect存到栈activeEffectStact中，数据更新后，重新执行该函数
		return run(effect, fn);
	}

	return effect;
}

function run(effect, fn) {
	try {
		activeEffectStact.push(effect);
		fn(); // 加try catch是为了防止fn报错
	} finally {
		// 数组放完一个后，执行pop
		activeEffectStact.pop();
	}
}


let targetsMap = new WeakMap();
// 如果属性值变化，就执行activeEffectStact里面的effect方法
function track(target, key) {
	// 取数组最后一个
	let effect = activeEffectStact[activeEffectStact.length -1];
	if (effect) {
		// 先看这个target有没有
		let depsMap = targetsMap.get(target);
		if (!depsMap) {
			depsMap = new Map();
			targetsMap.set(target, depsMap);
		}
		// 再看这个key有没有
		let deps = depsMap.get(key);
		if (!deps) {
			deps = new Set();
			depsMap.set(key, deps);
		}
		// 将activeEffectStact中的effect放到deps里面
		// 先判断deps里面有没有effect
		if (!deps.has(effect)) {
			deps.add(effect);
		}
	}
}

// 取出属性对应的effect执行
function trigger(target,type, key) {
	let depsMap = targetsMap.get(target);
	if (depsMap) {
		let deps = depsMap.get(key);
		if (deps) {
			deps.forEach(effect => effect());   // 将属性对应的effect执行
		}
	}
}

let obj = reactive({name: 'syh'});
effect(() => {
	console.info(obj.name); // 会执行2次
})

obj.name = 's';
obj.name = 's';

// // 代理对象
// let obj = [1, 2, 3];
// let proxy = reactive(obj);
// // proxy.push(4);
// proxy.pop();





