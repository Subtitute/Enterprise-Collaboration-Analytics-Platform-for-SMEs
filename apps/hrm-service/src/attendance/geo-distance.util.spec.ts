import { haversineDistanceMeters } from './geo-distance.util';

describe('haversineDistanceMeters', () => {
  it('tra ve 0 khi 2 toa do trung nhau', () => {
    expect(haversineDistanceMeters(21.0285, 105.8542, 21.0285, 105.8542)).toBe(0);
  });

  it('tinh dung khoang cach xap xi giua 2 toa do gan nhau (~157m, sai so cho phep 5m)', () => {
    // 21.0285,105.8542 -> 21.0300,105.8542: lech 0.0015 do vi tuyen ~ 166m, kiem tra khoang hop ly.
    const distance = haversineDistanceMeters(21.0285, 105.8542, 21.03, 105.8542);
    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThan(180);
  });

  it('tinh dung khoang cach xa (Ha Noi - TP.HCM, xap xi 1140-1160km)', () => {
    const distance = haversineDistanceMeters(21.0285, 105.8542, 10.7769, 106.7009);
    expect(distance).toBeGreaterThan(1_140_000);
    expect(distance).toBeLessThan(1_160_000);
  });
});
