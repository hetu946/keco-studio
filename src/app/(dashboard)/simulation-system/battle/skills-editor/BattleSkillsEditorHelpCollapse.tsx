import { Collapse, Typography } from 'antd';
import styles from './BattleSkillsEditorHelpCollapse.module.css';

export function BattleSkillsEditorHelpCollapse() {
  return (
    <Collapse
      items={[
        {
          key: 'help',
          label: '字段说明（不填则使用默认值）',
          children: (
            <Typography.Paragraph className={styles.helpParagraph} type="secondary">
              <ul className={styles.helpList}>
                <li>
                  配表数据以 <strong>IndexedDB</strong> 为主持久化（与资源库表格离线存储同类），并镜像到 localStorage
                  便于多标签页同步。
                </li>
                <li>
                  <strong>清除整张表格</strong>会保存空列表：战斗页暂无技能，直至新增行或<strong>恢复内置默认</strong>（会清除本地
                  存储）。
                </li>
                <li>
                  <strong>导出 / 导入配置</strong>：均为 <strong>Excel（.xlsx）</strong>，表头与「导出配置」文件一致；导入按 id
                  合并（已有 id 替换该行，新 id 追加）。失败条目可下载 <strong>JSON</strong> 备查。
                </li>
                <li>
                  表格与「+」在同一横向滚动层；<strong>横向滚动条在分页条上方</strong>。不使用列固定，避免盖住「+」。
                </li>
                <li>
                  <strong>非法行会被跳过</strong>：id/名称不合法、id 格式错误等整行不会写入；同一 id 多行时<strong>只保留最先一行</strong>。
                </li>
                <li>
                  <strong>关联反应</strong>：可选，用「元素 + 反应类型」逐条添加，用于战斗页技能卡上的展示标签；不写任何 JSON。当场伤害倍率仍以<strong>附着元素</strong>与目标元素自动判定为准。
                </li>
                <li>
                  <strong>id</strong>：唯一标识，仅字母、数字、下划线（必填）。
                </li>
                <li>
                  <strong>名称</strong>：显示名（必填）。
                </li>
                <li>
                  <strong>类型</strong>：一般为「攻击」；内置治疗通过「特殊效果」实现。
                </li>
                <li>
                  <strong>伤害倍率</strong>：乘以攻击力的系数，默认 1。
                </li>
                <li>
                  <strong>MP / 冷却</strong>：默认 0。
                </li>
                <li>
                  <strong>附着</strong>：选「无」则不附加元素；选元素后强度默认「弱」，持续回合按强度默认表（弱2/中3/强4），也可自填。
                </li>
                <li>
                  <strong>DOT</strong>：需同时填写倍率与回合数才生效。
                </li>
                <li>
                  <strong>冻结回合</strong>：填 0 表示无冻结。
                </li>
                <li>
                  <strong>特殊效果</strong>：治疗为系数×ATK；降攻/降为比例（如 0.15 表示 15%）。
                </li>
              </ul>
            </Typography.Paragraph>
          ),
        },
      ]}
    />
  );
}
