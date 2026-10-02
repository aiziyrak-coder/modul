import {
  COLLIDING_EVENT_TYPES,
  COUNCIL_VARIANT_SUFFIX,
  EVENT_REGISTRY,
  UNKNOWN_EVENT_ICON,
} from './event-registry';
import type { NotificationVM, RendererDescriptor, Shape } from './types';

const COUNCIL_CODE = /^[TUVE]$/;

function isCouncilVariant(vm: NotificationVM): boolean {
  const code = vm.metadata?.code;
  if (typeof code === 'string' && COUNCIL_CODE.test(code)) return true;
  return vm.rawLink?.startsWith('/kengash') ?? false;
}

function registryKeyFor(vm: NotificationVM): string {
  if (COLLIDING_EVENT_TYPES.has(vm.eventType) && isCouncilVariant(vm)) {
    return `${vm.eventType}${COUNCIL_VARIANT_SUFFIX}`;
  }
  return vm.eventType;
}

function fallbackDescriptor(vm: NotificationVM): RendererDescriptor {
  const shape: Shape =
    vm.body === null ? 'title-only' : vm.body.includes('\n') ? 'multiline' : 'single-line';
  return {
    shape,
    emphasis: 'title',
    tone: 'neutral',
    icon: UNKNOWN_EVENT_ICON,
    moduleLabelKey: 'notif.mod.unknown',
  };
}

function withEffectiveShape(descriptor: RendererDescriptor, vm: NotificationVM): RendererDescriptor {
  if (vm.body === null && descriptor.shape !== 'title-only') {
    return { ...descriptor, shape: 'title-only' };
  }
  return descriptor;
}

export function resolveEvent(vm: NotificationVM): RendererDescriptor {
  const descriptor = EVENT_REGISTRY[registryKeyFor(vm)] ?? fallbackDescriptor(vm);
  return withEffectiveShape(descriptor, vm);
}
