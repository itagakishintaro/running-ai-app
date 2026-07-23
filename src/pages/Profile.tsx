import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { Gender, calcAge, PREFECTURES } from "../types";
import { Card, Field, Input, Select, Button, EmptyState } from "../components/ui";

export function Profile() {
  const { user } = useAuth();
  const { profile, loading, saveProfile } = useProfile(user?.uid);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setBirthDate(profile.birthDate ?? "");
      setGender(profile.gender);
      setHeight(String(profile.heightCm));
      setWeight(String(profile.weightKg));
      setPrefecture(profile.prefecture ?? "");
      setCity(profile.city ?? "");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await saveProfile({
      name,
      birthDate,
      gender,
      heightCm: Number(height),
      weightKg: Number(weight),
      prefecture,
      city,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <EmptyState message="読み込み中..." />;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-5">プロフィール</h2>
      <Card padding="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="名前">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field
            label="生年月日"
            hint={birthDate ? `現在の年齢: ${calcAge(birthDate)}歳` : undefined}
          >
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="性別">
            <Select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </Select>
          </Field>
          <Field label="身長 (cm)">
            <Input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              required
              min={100}
              max={250}
            />
          </Field>
          <Field label="体重 (kg)">
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
              min={30}
              max={200}
              step="0.1"
            />
          </Field>
          <Field
            label="居住地（都道府県）"
            hint="近場のマラソン大会を探すときに使います"
          >
            <Select value={prefecture} onChange={(e) => setPrefecture(e.target.value)}>
              <option value="">未選択</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="市区町村（任意）">
            <Input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="例: 渋谷区"
            />
          </Field>
          <Button type="submit" loading={saving} size="lg" className="w-full">
            {saving ? "保存中..." : saved ? "✓ 保存しました" : "保存する"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
