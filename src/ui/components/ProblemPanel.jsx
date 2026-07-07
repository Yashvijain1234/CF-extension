import {
  ratingToDifficulty,
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
} from '@/services/difficulty';
import { Badge, Collapsible } from './common';
import { StatementView } from './StatementView';
import { SampleCard } from './SampleCard';
import { ProgressControls } from './ProgressControls';

export function ProblemPanel({ problem, progress, onProgressChange, onUseSample }) {
  const difficulty = ratingToDifficulty(problem.rating);
  const color = DIFFICULTY_COLOR[difficulty];

  return (
    <div className="flex h-full flex-col">
      {/* Sticky title / meta header */}
      <div className="sticky top-0 z-10 border-b border-cf-border bg-cf-bg/95 px-5 pb-3 pt-4 backdrop-blur">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-tight text-cf-text">
            {problem.contestId}
            {problem.problemIndex}. {problem.title}
          </h1>
          <ProgressControls progress={progress} onChange={onProgressChange} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={color}>
            {DIFFICULTY_LABEL[difficulty]}
            {problem.rating ? ` · ${problem.rating}` : ''}
          </Badge>
          <Badge className="border border-cf-border bg-cf-surface-2 text-cf-muted">
            ⏱ {problem.timeLimit}
          </Badge>
          <Badge className="border border-cf-border bg-cf-surface-2 text-cf-muted">
            💾 {problem.memoryLimit}
          </Badge>
          <a
            href={problem.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-cf-accent hover:underline"
          >
            Original ↗
          </a>
        </div>
        {problem.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {problem.tags.map((t) => (
              <Badge
                key={t}
                className="border border-cf-border bg-cf-surface text-cf-muted"
              >
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <StatementView html={problem.statement} />

        {problem.inputSpecification && (
          <Collapsible title="Input">
            <StatementView html={problem.inputSpecification} />
          </Collapsible>
        )}
        {problem.outputSpecification && (
          <Collapsible title="Output">
            <StatementView html={problem.outputSpecification} />
          </Collapsible>
        )}

        {problem.samples.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-cf-text">Examples</h3>
            {problem.samples.map((s) => (
              <SampleCard key={s.index} sample={s} onUseAsInput={onUseSample} />
            ))}
          </div>
        )}

        {problem.note && (
          <Collapsible title="Note" defaultOpen={false}>
            <StatementView html={problem.note} />
          </Collapsible>
        )}
      </div>
    </div>
  );
}
