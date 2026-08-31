import { useLocalization } from '@fluent/react';
import { Typography } from '@/components/commons/Typography';
import {
  FirmwareToolContextC,
  provideFirmwareTool,
} from '@/hooks/firmware-tool';
import VerticalStepper, {
  VerticalStep,
} from '@/components/commons/VerticalStepper';
import { useMemo } from 'react';
import { FlashingMethodStep } from './steps/FlashingMethodStep';
import { FlashingStep } from './steps/FlashingStep';

function FirmwareToolContent() {
  const { l10n } = useLocalization();
  const context = provideFirmwareTool();

  const steps = useMemo(() => {
    const steps: VerticalStep[] = [
      {
        id: 'FlashingMethod',
        component: FlashingMethodStep,
        title: l10n.getString('firmware_tool-flash_method_step'),
      },
      {
        component: FlashingStep,
        title: l10n.getString('firmware_tool-flashing_step'),
      },
    ];
    return steps;
  }, [l10n]);

  return (
    <FirmwareToolContextC.Provider value={context}>
      <div className="flex flex-col bg-background-70 p-4 rounded-md">
        <Typography variant="main-title">
          {l10n.getString('firmware_tool')}
        </Typography>
        <div className="flex flex-col pt-2 pb-4">
          <>
            {l10n
              .getString('firmware_tool-description')
              .split('\n')
              .map((line, i) => (
                <Typography key={i}>{line}</Typography>
              ))}
          </>
        </div>
        <div className="m-4 h-full">
          <VerticalStepper steps={steps} />
        </div>
      </div>
    </FirmwareToolContextC.Provider>
  );
}

export function FirmwareToolSettings() {
  return <FirmwareToolContent />;
}
