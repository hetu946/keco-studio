'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { showSuccessToast, showErrorToast } from '@/lib/utils/toast';
import { useSupabase } from '@/lib/SupabaseContext';
import { validateName } from '@/lib/utils/nameValidation';
import styles from './ImportScriptModal.module.css';

type ImportScriptModalProps = {
  open: boolean;
  projectId: string;
  folderId: string;
  onClose: () => void;
  onImported?: (libraryId: string) => void;
};

type PreviewInfo = {
  lineCount: number;
  dialogueCount: number;
  optionCount: number;
};

type InputMode = 'file' | 'text';

// 标准格式示例 - 按照这个格式输入可以确保解析正确
const STANDARD_FORMAT_EXAMPLE = `【Start｜午后，狭小公寓，阳光透过窗帘洒进房间】
（Type3・旁白）午后三点，连续通宵的阿塔那趴在键盘边小憩。
（Type2・AI）检测到你已连续22小时未正常进食，心率偏低。
（Type1・阿塔那）唔……别吵，还差最后一段代码。
（Type3・旁白）屏幕侧边弹出三个互动选项。
O1：顺从提议，出门觅食（$trust+=2，跳转O1分支）
O2：讨价还价，再写半小时（$pally+=1，跳转O2分支）
O3：直接耍赖，屏蔽提醒（$rely-=1，跳转O3分支）
O1 分支【O1｜阿塔那伸懒腰起身】
（Type1・阿塔那）行吧，难得听你一回，正好下楼逛逛。
（Type2・AI）我提前检索周边商铺，选定一家轻食店。
（跳转 Oend）
O2 分支【O2｜阿塔那指尖重新落回键盘】
（Type1・阿塔那）就半小时，定好计时器，到点立马停手。
（Type2・AI）已设置倒计时，同时远程预定餐品。
（跳转 Oend）
O3 分支【O3｜阿塔那快速敲入代码】
（Type1・阿塔那）先把提醒关掉，饮食问题我自己把控。
（Type2・AI）权限屏蔽临时生效，但我会同步健康数据。
（跳转 Oend）
Oend 统一收尾【Oend｜傍晚，公寓餐桌】
（Type2・AI）长期规律用餐后，你的工作效率上涨11%。
（Type1・阿塔那）客观数据确实没法反驳，以后折中。
（Type3・旁白）窗外落日染红楼宇，一人一机继续筹备后续工作。`;

// 格式说明内容
const FORMAT_GUIDE = {
  title: '标准输入格式说明',
  sections: [
    {
      title: '1. 场景标签',
      format: '【标签名｜场景描述】',
      example: '【Start｜午后，狭小公寓】',
      note: '标签名可以是 Start、O1、O2 等',
    },
    {
      title: '2. 对话',
      format: '（TypeX・角色名）对话内容',
      example: '（Type1・阿塔那）你好世界',
      note: 'Type 1=蓝色对话框, 2=粉色, 3=灰色(旁白), 4=无对话框, 5=全屏',
    },
    {
      title: '3. 选项',
      format: 'O序号：选项文本（$变量+=值，跳转O序号分支）',
      example: 'O1：选择A（$trust+=2，跳转O1分支）',
      note: '选项必须放在选择前的对话后面',
    },
    {
      title: '4. 分支声明',
      format: 'O序号 分支【O序号｜场景描述】',
      example: 'O1 分支【O1｜阿塔那起身】',
      note: '每个选项对应一个分支',
    },
    {
      title: '5. 跳转指令',
      format: '（跳转 目标标签）',
      example: '（跳转 Oend）',
      note: '分支结束时跳转到统一收尾',
    },
    {
      title: '6. 统一收尾',
      format: 'Oend 统一收尾【Oend｜场景描述】',
      example: 'Oend 统一收尾【Oend｜傍晚，餐桌】',
      note: '所有分支汇合的地方',
    },
  ],
  tips: [
    '每条指令独占一行，不要在同一行写多个指令',
    '变量格式：$变量名+=值 或 $变量名-=值',
    '跳转目标必须与分支标签匹配',
    'Type3 是旁白，角色名可以为空',
  ],
};

function previewScript(text: string): PreviewInfo {
  const lines = text.split('\n').filter(l => l.trim());
  const dialogueCount = lines.filter(l => /[:：]/.test(l) && !l.trim().startsWith('【')).length;
  const optionCount = lines.filter(l => /^\s*-\s/.test(l) || /^【选项/.test(l)).length;
  return { lineCount: lines.length, dialogueCount, optionCount };
}

function defaultLibraryNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return base || '导入的剧本';
}

export function ImportScriptModal({
  open,
  projectId,
  folderId,
  onClose,
  onImported,
}: ImportScriptModalProps) {
  const supabase = useSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [libraryName, setLibraryName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [preview, setPreview] = useState<PreviewInfo | null>(null);
  const [importing, setImporting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setLibraryName('');
      setSelectedFile(null);
      setTextInput('');
      setPreview(null);
      setInputMode('file');
    }
  }, [open]);

  useEffect(() => {
    if (inputMode === 'text' && textInput.trim()) {
      setPreview(previewScript(textInput));
    } else if (inputMode === 'file' && !selectedFile) {
      setPreview(null);
    }
  }, [textInput, inputMode, selectedFile]);

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['txt', 'md'].includes(ext)) {
      showErrorToast('请选择 .txt 或 .md 文件');
      return;
    }

    setSelectedFile(file);
    if (!libraryName.trim()) {
      setLibraryName(defaultLibraryNameFromFile(file.name));
    }

    try {
      const text = await file.text();
      setPreview(previewScript(text));
    } catch {
      setPreview(null);
      showErrorToast('读取文件失败');
    }
  };

  const handleImport = async () => {
    const trimmedName = libraryName.trim();
    if (!trimmedName) {
      showErrorToast('请输入库名称');
      return;
    }

    const nameError = validateName(trimmedName);
    if (nameError) {
      showErrorToast(nameError);
      return;
    }

    let fileContent = '';
    let fileName = 'input.txt';

    if (inputMode === 'file') {
      if (!selectedFile) {
        showErrorToast('请选择文件');
        return;
      }
      try {
        fileContent = await selectedFile.text();
        fileName = selectedFile.name;
      } catch {
        showErrorToast('读取文件失败');
        return;
      }
    } else {
      if (!textInput.trim()) {
        showErrorToast('请输入剧本文本');
        return;
      }
      fileContent = textInput;
      fileName = `${trimmedName}.txt`;
    }

    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('请先登录');
      }

      const formData = new FormData();
      formData.append('projectId', projectId);
      formData.append('folderId', folderId);
      formData.append('libraryName', trimmedName);
      formData.append('file', new File([fileContent], fileName, { type: 'text/plain' }));

      const res = await fetch('/api/import-script', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const payload = await res.json().catch(() => ({ error: res.statusText }));
      if (!res.ok) {
        throw new Error(payload.error || '导入失败');
      }

      showSuccessToast(`剧本导入成功 (${payload.rowCount ?? 0} 行)`);
      onImported?.(payload.libraryId);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : '导入失败';
      showErrorToast(message);
    } finally {
      setImporting(false);
    }
  };

  const handleLoadStandardExample = () => {
    setTextInput(STANDARD_FORMAT_EXAMPLE);
    if (!libraryName.trim()) {
      setLibraryName('标准格式示例');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const canImport = inputMode === 'file'
    ? !!selectedFile && !!libraryName.trim()
    : !!textInput.trim() && !!libraryName.trim();

  if (!open) return null;
  if (!mounted) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>导入剧本</div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={styles.divider} />
        <div className={styles.content}>
          <p className={styles.hint}>
            将剧本文本解析为结构化脚本。支持多种书写格式：对话、选项、舞台指示、条件标注等。
          </p>

          <div className={styles.nameContainer}>
            <label htmlFor="import-script-name" className={styles.nameLabel}>库名称</label>
            <input
              id="import-script-name"
              className={styles.nameInput}
              value={libraryName}
              onChange={(e) => setLibraryName(e.target.value)}
              placeholder="输入库名称"
              disabled={importing}
            />
          </div>

          <div className={styles.tabContainer}>
            <button
              className={`${styles.tab} ${inputMode === 'file' ? styles.tabActive : ''}`}
              onClick={() => setInputMode('file')}
              disabled={importing}
            >
              文件上传
            </button>
            <button
              className={`${styles.tab} ${inputMode === 'text' ? styles.tabActive : ''}`}
              onClick={() => setInputMode('text')}
              disabled={importing}
            >
              文本输入
            </button>
          </div>

          {inputMode === 'file' ? (
            <div className={styles.fileContainer}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                disabled={importing}
              />
              <button
                type="button"
                className={styles.fileButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {selectedFile ? '更换文件' : '选择文件'}
              </button>
              {selectedFile && (
                <p className={styles.fileName}>{selectedFile.name}</p>
              )}
              <p className={styles.fileHint}>支持 .txt 和 .md 格式</p>
            </div>
          ) : (
            <div className={styles.textContainer}>
              <div className={styles.textActions}>
                <button
                  type="button"
                  className={styles.exampleButton}
                  onClick={handleLoadStandardExample}
                  disabled={importing}
                >
                  加载标准格式示例
                </button>
              </div>
              <textarea
                className={styles.textarea}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`按照标准格式输入剧本...\n\n点击"加载标准格式示例"查看完整示例\n或点击下方"格式说明"查看详细规则`}
                disabled={importing}
                rows={10}
              />
            </div>
          )}

          {/* 格式说明 */}
          <div className={styles.formatGuide}>
            <button
              type="button"
              className={styles.formatGuideToggle}
              onClick={() => setShowFormatGuide(!showFormatGuide)}
            >
              <span>{showFormatGuide ? '▼' : '▶'} 格式说明</span>
              <span className={styles.formatGuideHint}>
                {showFormatGuide ? '点击收起' : '点击查看标准格式'}
              </span>
            </button>
            {showFormatGuide && (
              <div className={styles.formatGuideContent}>
                <p className={styles.formatGuideTitle}>{FORMAT_GUIDE.title}</p>
                {FORMAT_GUIDE.sections.map((section, idx) => (
                  <div key={idx} className={styles.formatSection}>
                    <p className={styles.formatSectionTitle}>{section.title}</p>
                    <code className={styles.formatCode}>{section.format}</code>
                    <p className={styles.formatExample}>示例：{section.example}</p>
                    <p className={styles.formatNote}>{section.note}</p>
                  </div>
                ))}
                <div className={styles.formatTips}>
                  <p className={styles.formatTipsTitle}>💡 提示</p>
                  <ul className={styles.formatTipsList}>
                    {FORMAT_GUIDE.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {preview && (
            <div className={styles.preview}>
              <span className={styles.previewLabel}>预览:</span>
              <span>{preview.lineCount} 行</span>
              <span className={styles.previewDot}>·</span>
              <span>{preview.dialogueCount} 句对话</span>
              {preview.optionCount > 0 && (
                <>
                  <span className={styles.previewDot}>·</span>
                  <span>{preview.optionCount} 个选项</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className={styles.divider} />
        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={importing}
          >
            取消
          </button>
          <button
            className={styles.primaryButton}
            onClick={handleImport}
            disabled={importing || !canImport}
          >
            {importing ? (
              <>
                <span className={styles.spinner} aria-hidden />
                导入中...
              </>
            ) : (
              '导入'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
