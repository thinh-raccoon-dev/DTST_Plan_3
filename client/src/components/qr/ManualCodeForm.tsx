import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractQrCode } from '../../lib/qr';
import { Button } from '../ui/Button';
import { FormField, Input } from '../ui/Field';

export function ManualCodeForm() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        const code = extractQrCode(value);
        if (!code) {
          setError('Mã không hợp lệ. Nhập mã in dưới QR (ví dụ TRAMCHIM-01) hoặc đường dẫn /qr/… của hệ thống.');
          return;
        }
        navigate(`/qr/${code}`);
      }}
    >
      <FormField label="Nhập mã hoặc đường dẫn QR" error={error} className="flex-1">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          placeholder="Ví dụ: TRAMCHIM-01"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>
      <Button type="submit" className="sm:mt-7">
        Mở nội dung
      </Button>
    </form>
  );
}
