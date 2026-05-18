<template>
  <Transition name="modal">
    <div v-if="visible" class="guide-overlay" @click.self="dismiss">
      <div class="guide-card">
        <div class="guide-icon">{{ info.icon }}</div>
        <h2>{{ info.name }}</h2>
        <p class="guide-desc">{{ info.desc }}</p>
        <div class="guide-tips">
          <div v-for="(tip, i) in info.tips" :key="i" class="tip-item">
            <span class="tip-dot"></span>
            <span>{{ tip }}</span>
          </div>
        </div>
        <button class="btn-primary" @click="dismiss">我知道了</button>
        <label class="dont-show">
          <input type="checkbox" v-model="dontShow" /> 不再提示此角色
        </label>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({ role: String });
const visible = ref(false);
const dontShow = ref(false);

const GUIDES = {
  werewolf: { icon: '🐺', name: '狼人', desc: '你是隐藏在人群中的暗夜猎手。每个夜晚，你与同伴共同选择一名玩家猎杀。白天则需要伪装自己，引导投票。', tips: ['夜晚与同伴商量击杀目标', '白天发言时尽量隐藏身份', '投票时可以投给好人以制造混乱'] },
  seer: { icon: '🔮', name: '预言家', desc: '你拥有洞察真相的能力。每个夜晚，你可以查验一名玩家的身份，得知其是否为狼人。', tips: ['每晚查验一名玩家', '谨慎选择何时公开查验结果', '你的信息对好人阵营至关重要'] },
  witch: { icon: '🧪', name: '女巫', desc: '你掌握生死之药。拥有一瓶解药（救人）和一瓶毒药（杀人），各限用一次。', tips: ['解药可以救活被狼人杀害的玩家', '毒药可以在夜晚毒杀任意玩家', '同一晚不能同时使用两种药'] },
  hunter: { icon: '🔫', name: '猎人', desc: '你是不屈的战士。当你死亡时（非中毒），可以开枪带走一名玩家。', tips: ['死亡时可以选择开枪或放弃', '被女巫毒杀时无法开枪', '开枪时机很重要，请谨慎选择'] },
  guard: { icon: '🛡️', name: '守卫', desc: '你是村庄的守护者。每个夜晚，你可以守护一名玩家使其免受狼人攻击，但不能连续两晚守护同一人。', tips: ['选择最可能被袭击的玩家守护', '不能连续两晚守同一人', '你可以守护自己'] },
  villager: { icon: '👤', name: '村民', desc: '你是普通村民，没有特殊能力。但你的一票在白天审判中至关重要。仔细听取发言，找出狼人！', tips: ['认真听取每个玩家的发言', '通过逻辑分析找出可疑之人', '在投票时做出正确选择'] },
};

const info = computed(() => GUIDES[props.role] || { icon: '?', name: '', desc: '', tips: [] });

watch(() => props.role, (r) => {
  if (r && GUIDES[r] && !localStorage.getItem('werewolf_guide_' + r)) {
    visible.value = true;
    dontShow.value = false;
  }
});

function dismiss() {
  if (dontShow.value && props.role) {
    localStorage.setItem('werewolf_guide_' + props.role, '1');
  }
  visible.value = false;
}
</script>

<style scoped>
.guide-overlay {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  background: rgba(4, 3, 12, 0.8); padding: 20px;
}
.guide-card {
  background: rgba(18, 14, 35, 0.96);
  border: 1px solid rgba(212, 168, 75, 0.15);
  border-radius: 2px; padding: 36px 32px;
  max-width: 400px; width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.4s ease;
}
.guide-icon { font-size: 52px; margin-bottom: 12px; }
.guide-card h2 { font-size: 24px; color: #d4a84b; letter-spacing: 4px; margin-bottom: 12px; }
.guide-desc { font-size: 13px; color: #b0a8c0; line-height: 1.8; margin-bottom: 18px; }
.guide-tips { text-align: left; margin-bottom: 24px; }
.tip-item { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; font-size: 12px; color: #8a8098; }
.tip-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(212, 168, 75, 0.4); flex-shrink: 0; margin-top: 6px; }
.dont-show {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 12px; font-size: 11px; color: #4a4460; cursor: pointer;
}
.dont-show input { accent-color: #d4a84b; }

.modal-enter-active { transition: all 0.3s ease; }
.modal-leave-active { transition: all 0.4s ease; }
.modal-enter-from { opacity: 0; }
.modal-leave-to { opacity: 0; }
</style>
